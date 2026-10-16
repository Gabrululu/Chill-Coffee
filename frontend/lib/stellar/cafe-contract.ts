import { Asset, StrKey, hash, Transaction, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { rpc, type contract } from '@stellar/stellar-sdk';
import { Client } from './generated/client';
import { CAFE_CONTRACT_ID, DEFAULT_CAFE, MAX_FEE_STROOPS, TESTNET, TIP_STROOPS } from './config';
import { getAccountInfo } from './account';
import { assertCompatibleWasm } from './compatibility';
import { assertCafeAuthorization } from './authorization';
import type { CafeTarget } from '../cafe/registry';
import { WalletError } from './errors';
import { rpcFailure } from './service-status';
import { createTestnetRpcTransport } from './rpc-transport';

export const server = new rpc.Server(TESTNET.rpcUrl, { timeout: 15_000 });
const rpcTransport = createTestnetRpcTransport();
// SDK 17 exposes its HTTP adapter. Set real timeouts at the transport boundary.
server.httpClient.defaults.adapter = async config => ({
  data: await rpcTransport.request(typeof config.data === 'string' ? JSON.parse(config.data) : config.data),
  status: 200, statusText: 'OK', headers: {}, config,
});
server.httpClient.interceptors.response.use(response => response, (error: unknown) => { throw error instanceof WalletError ? error : rpcFailure(error); });
export type PreparedTip = { target?: CafeTarget; cafeName?: string; reviewedHash?: string; transaction: contract.AssembledTransaction<contract.Result<bigint>>; fee: string; destination: string; account: string; requestId: string; contractId: string };

export async function assertTestnet(): Promise<void> {
  const network = await server.getNetwork();
  if (network.passphrase !== TESTNET.passphrase || Number(network.protocolVersion) < 29) throw new WalletError('wrong-rpc', 'The RPC is not the expected Stellar Testnet network.');
}
export async function getCafeClient(publicKey?: string, target: CafeTarget = DEFAULT_CAFE): Promise<Client> {
  if (!StrKey.isValidContract(target.contractId)) throw new WalletError('invalid-contract', 'Configure a valid Testnet Café contract ID.');
  return new Client({ contractId: target.contractId, rpcUrl: TESTNET.rpcUrl, networkPassphrase: TESTNET.passphrase, publicKey, server });
}
export async function readCafeConfig(target: CafeTarget = DEFAULT_CAFE) {
  await assertTestnet();
  // The UI uses generated ABI types, so reject a deployment with different code.
  const wasm = await server.getContractWasmByContractId(target.contractId);
  const digest = Array.from(hash(wasm), byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== target.wasmHash) throw new WalletError('contract-mismatch', 'This café code differs from its approved WASM hash. Ask the host to review the deployment before using it.');
  assertCompatibleWasm(wasm);
  const client = await getCafeClient(undefined, target);
  const config = (await client.get_config()).result.unwrap();
  if (config.payment_token !== Asset.native().contractId(TESTNET.passphrase) || !StrKey.isValidEd25519PublicKey(config.barista)) {
    throw new WalletError('wrong-asset', 'This Café is not configured for native Testnet XLM and a valid barista.');
  }
  if (target.barista && config.barista !== target.barista) throw new WalletError('barista-changed', 'The café barista differs from the approved directory.');
  return config;
}
export async function prepareTip(account: string, requestId: string, expectedBarista: string, target: CafeTarget = DEFAULT_CAFE): Promise<PreparedTip> {
  if (!StrKey.isValidEd25519PublicKey(account)) throw new WalletError('invalid-account', 'Connect a valid Stellar account first.');
  if (!/^[a-f0-9]{64}$/.test(requestId)) throw new WalletError('invalid-request', 'Invalid transaction request ID.');
  if (!(await getAccountInfo(account)).funded) throw new WalletError('unfunded', 'Get Testnet XLM before preparing your thank-you.');
  const config = await readCafeConfig(target);
  if (config.barista !== expectedBarista) throw new WalletError('recipient-changed', 'The barista differs from the recipient you reviewed. Refresh before continuing.');
  if (account === config.barista) throw new WalletError('self-tip', 'The event barista cannot tip themselves. Connect a different Testnet account.');
  const client = await getCafeClient(account, target);
  const request = Uint8Array.from(requestId.match(/../g)!, byte => parseInt(byte, 16));
  const transaction = await client.tip_barista({ buyer: account, amount: TIP_STROOPS, request_id: request }, { timeoutInSeconds: 180 });
  transaction.result.unwrap(); // A preview is not confirmation; it only validates simulation.
  if (!transaction.built || transaction.isReadCall) throw new WalletError('invalid-preview', 'The Café did not prepare the expected payable transaction.');
  const fee = transaction.built.fee;
  if (BigInt(fee) > MAX_FEE_STROOPS) throw new WalletError('fee-too-high', 'Estimated fees exceed the workshop limit of 1 Testnet XLM. Try again later.');
  assertCafeAuthorization(transaction.built, { account, contractId: target.contractId, method: 'tip_barista', destination: config.barista, amount: TIP_STROOPS });
  return { transaction, fee, destination: config.barista, account, requestId, contractId: target.contractId, target, cafeName: target.name, reviewedHash: Array.from(transaction.built.hash(), b => b.toString(16).padStart(2, '0')).join('') };
}


export type CafeAction =
  | { target?: CafeTarget; kind: 'register'; recipe: import('../types').Recipe }
  | { target?: CafeTarget; kind: 'order'; itemId: string; priceStroops: string; creator: string; name: string }
  | { target?: CafeTarget; kind: 'serve'; orderId: string; name: string };
export type PreparedOperation = {
  transaction: Pick<contract.AssembledTransaction<unknown>, 'sign' | 'signed' | 'built' | 'isReadCall'>;
  fee: string; account: string; contractId: string; requestId: string;
  kind: import('./transaction').OperationKind; title: string; destination?: string;
  amountStroops?: string; itemId?: string; orderId?: string; cafeName?: string; reviewedHash?: string; target?: CafeTarget;
};
export async function readCafeSnapshot(target: CafeTarget = DEFAULT_CAFE) {
  const { readAllPages, mapItem, mapOrder } = await import('./cafe-data');
  // Capture BEFORE the reads so changes arriving during pagination are checked next.
  const ledger = await server.getLatestLedger();
  const config = await readCafeConfig(target);
  const client = await getCafeClient(undefined, target);
  const [items, orders] = await Promise.all([
    readAllPages(async (start, limit) => (await client.get_items({ start, limit })).result.unwrap()),
    readAllPages(async (start, limit) => (await client.get_orders({ start, limit })).result.unwrap()),
  ]);
  return { items: items.map(mapItem), orders: orders.map(mapOrder), barista: config.barista, nextLedger: ledger.sequence };
}
export async function prepareCafeAction(account: string, requestId: string, action: CafeAction): Promise<PreparedOperation> {
  const target = action.target ?? DEFAULT_CAFE;
  if (action.kind === 'register' && target.owner && target.owner !== account) throw new WalletError('not-cafe-owner', 'Connect the owner wallet to create a recipe in this café.');
  const { chainId, toChainRecipe } = await import('./cafe-data');
  if (!StrKey.isValidEd25519PublicKey(account)) throw new WalletError('invalid-account', 'Connect a valid Stellar account first.');
  if (!/^[a-f0-9]{64}$/.test(requestId)) throw new WalletError('invalid-request', 'Invalid transaction request ID.');
  if (!(await getAccountInfo(account)).funded) throw new WalletError('unfunded', 'Get Testnet XLM before brewing on-chain.');
  const config = await readCafeConfig(target);
  const client = await getCafeClient(account, target);
  const options = { timeoutInSeconds: 180 };
  const common = { account, requestId, contractId: target.contractId, kind: action.kind, cafeName: target.name, target };
  let operation: Omit<PreparedOperation, 'fee'>;
  if (action.kind === 'register') {
    const recipe = toChainRecipe(action.recipe);
    const transaction = await client.register_item({ creator: account, recipe }, options);
    transaction.result.unwrap();
    operation = { ...common, transaction, title: `Register ${recipe.name}` };
  } else if (action.kind === 'order') {
    const item = (await client.get_item({ id: chainId(action.itemId) })).result.unwrap();
    if (item.creator === account) throw new WalletError('self-order', 'Choose a creation by another participant.');
    if (item.creator !== action.creator || item.price.toString() !== action.priceStroops) throw new WalletError('item-changed', 'The recipe or price changed. Refresh the menu before ordering.');
    const nonce = Uint8Array.from(requestId.match(/../g)!, byte => parseInt(byte, 16));
    const transaction = await client.order_item({ buyer: account, item_id: item.id, expected_price: item.price, request_id: nonce }, options);
    const preview = transaction.result.unwrap();
    if (preview.item_id !== item.id || preview.buyer !== account || preview.creator !== item.creator || preview.status.tag !== 'Pending' || preview.amount <= 0n || preview.amount > item.price) throw new WalletError('invalid-price', 'This café returned an unexpected order or charge above the menu price.');
    operation = { ...common, transaction, title: `Order ${item.name}`, itemId: item.id.toString(), destination: item.creator, amountStroops: preview.amount.toString() };
  } else {
    const order = (await client.get_order({ id: chainId(action.orderId) })).result.unwrap();
    if (order.status.tag !== 'Pending') throw new WalletError('already-served', 'This order has already been served. Refresh the queue.');
    if (order.creator !== account && config.barista !== account) throw new WalletError('unauthorized', 'Only this recipe’s creator or the event barista can serve it.');
    const transaction = await client.mark_served({ order_id: order.id, served_by: account }, options);
    transaction.result.unwrap();
    operation = { ...common, transaction, title: `Serve ${action.name}`, orderId: order.id.toString(), itemId: order.item_id.toString() };
  }
  if (!operation.transaction.built || operation.transaction.isReadCall) throw new WalletError('invalid-preview', 'The café did not prepare the expected transaction.');
  const fee = operation.transaction.built.fee;
  if (BigInt(fee) > MAX_FEE_STROOPS) throw new WalletError('fee-too-high', 'Estimated fees exceed the workshop limit of 1 Testnet XLM. Try again later.');
  assertCafeAuthorization(operation.transaction.built, { account, contractId: target.contractId, method: action.kind === 'register' ? 'register_item' : action.kind === 'order' ? 'order_item' : 'mark_served', destination: operation.destination, amount: operation.amountStroops ? BigInt(operation.amountStroops) : undefined });
  const reviewedHash = Array.from(operation.transaction.built.hash(), b => b.toString(16).padStart(2, '0')).join('');
  return { ...operation, fee, reviewedHash };
}
export async function readConfirmedEntity(hash: string, kind: import('./transaction').OperationKind, contractId = CAFE_CONTRACT_ID): Promise<string | undefined> {
  if (kind === 'tip') return undefined;
  const response = await server.getTransaction(hash);
  if (response.status !== 'SUCCESS' || !response.returnValue) throw new WalletError('unconfirmed-result', 'Wait for a confirmed transaction before reading its result.');
  const method = kind === 'register' ? 'register_item' : kind === 'order' ? 'order_item' : 'mark_served';
  const envelope = TransactionBuilder.fromXdr(response.envelopeXdr.toXdr('base64'), TESTNET.passphrase);
  const operation = envelope instanceof Transaction && envelope.operations.length === 1 ? envelope.operations[0] : null;
  if (!operation || operation.type !== 'invokeHostFunction' || operation.func.type !== 'hostFunctionTypeInvokeContract' || operation.func.value.functionName.toString() !== method || operation.func.value.contractAddress.toXdr('base64') !== new (await import('@stellar/stellar-sdk/base')).Address(contractId).toScAddress().toXdr('base64')) throw new WalletError('wrong-receipt', 'This transaction belongs to another café or operation.');
  const client = await getCafeClient(undefined, { ...DEFAULT_CAFE, contractId });
  const result = client.spec.funcResToNative(method, response.returnValue) as contract.Result<{ id: bigint }>;
  return result.unwrap().id.toString();
}

export async function probeCafeChanges(startLedger: number, eventServer: Pick<rpc.Server, 'getEvents'> = server, contractId = CAFE_CONTRACT_ID): Promise<{ changed: boolean; nextLedger: number }> {
  try {
    const response = await eventServer.getEvents({ startLedger, filters: [{ type: 'contract', contractIds: [contractId] }], limit: 1 });
    return { changed: response.events.length > 0, nextLedger: response.latestLedger + 1 };
  } catch {
    // An expired cursor, reset network or unavailable event service must never
    // be interpreted as "no changes". The caller falls back to a full read.
    return { changed: true, nextLedger: startLedger };
  }
}
