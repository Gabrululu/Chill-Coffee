import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Asset, Keypair, Operation, TransactionBuilder, hash, type Transaction } from '@stellar/stellar-sdk/base';
import { Client } from '../frontend/lib/stellar/generated/client';
import { TESTNET } from '../frontend/lib/stellar/config';
import { fundTestnetAccount, getAccountInfo } from '../frontend/lib/stellar/account';
import { prepareCafeAction, readCafeSnapshot, readConfirmedEntity, server, readCafeConfig, type CafeAction } from '../frontend/lib/stellar/cafe-contract';
import { submitTransaction } from '../frontend/lib/stellar/transaction';
import { createCommunityReader } from '../frontend/lib/cafe/community';
import { assertCompatibleWasm } from '../frontend/lib/stellar/compatibility';
import { xlmToStroops } from '../frontend/lib/stellar/amount';
import type { CafeEntry } from '../frontend/lib/cafe/registry';

const nonce = () => randomBytes(32).toString('hex');
const leb = (n: number) => { const bytes: number[] = []; do { let b = n & 127; n >>>= 7; if (n) b |= 128; bytes.push(b); } while (n); return bytes; };
async function main() {
  const { values } = parseArgs({ options: { help: { type: 'boolean' } } });
  if (values.help) { console.log('pnpm community:smoke\nTESTNET writes: funds two ephemeral accounts, deploys two cafés, registers/orders/serves across them. A second WASM differs by a harmless custom metadata section, not pricing logic. Keys remain in memory; public hashes are saved before each send.'); return; }
  console.log('TESTNET ONLY · Two cafés, two in-memory owners. Real test writes; no Freighter popup automation.');
  const first = Keypair.random(), second = Keypair.random();
  const file = `deployments/community-${Date.now()}.local.json`;
  const receipt = { network: 'testnet', status: 'running', cafes: [] as CafeEntry[], transactions: [] as { label: string; hash?: string; stage: string }[], verified: [] as string[] };
  mkdirSync('deployments', { recursive: true });
  const save = () => writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
  save(); console.log(`Public receipt: ${file}`);
  await Promise.all([fundTestnetAccount(first.publicKey()), fundTestnetAccount(second.publicKey())]);
  async function send(transaction: Transaction, label: string) {
    const record = { label, stage: 'preparing', hash: undefined as string | undefined }; receipt.transactions.push(record);
    const result = await submitTransaction(server, transaction, state => { record.stage = state.stage; record.hash = state.hash; save(); console.log(`${label}: ${state.stage} ${state.hash ?? ''}`); });
    assert.equal(result.stage, 'confirmed', `Resolve the hash in ${file} before another rehearsal.`); return result.hash!;
  }
  const sign = (key: Keypair) => async (xdr: string) => {
    const transaction = TransactionBuilder.fromXdr(xdr, TESTNET.passphrase); transaction.sign(key);
    return { signedTxXdr: transaction.toXdr(), signerAddress: key.publicKey() };
  };
  const baseWasm = readFileSync('target/wasm32v1-none/release/cafe_menu.wasm');
  assertCompatibleWasm(baseWasm);
  const sectionName = new TextEncoder().encode('chill-cafe-workshop');
  const payload = new Uint8Array([...leb(sectionName.length), ...sectionName, ...randomBytes(8)]);
  const variant = new Uint8Array([...baseWasm, 0, ...leb(payload.length), ...payload]);
  assertCompatibleWasm(variant);
  const upload = await server.prepareTransaction(new TransactionBuilder(await server.getAccount(second.publicKey()), { fee: '100', networkPassphrase: TESTNET.passphrase }).addOperation(Operation.uploadContractWasm({ wasm: variant })).setTimeout(180).build());
  upload.sign(second); await send(upload, 'upload-variant');
  const wasmHashes = [Buffer.from(hash(baseWasm)).toString('hex'), Buffer.from(hash(variant)).toString('hex')];
  assert.notEqual(wasmHashes[0], wasmHashes[1]);
  for (const [index, key] of [first, second].entries()) {
    const deployment = await Client.deploy({ barista: key.publicKey(), payment_token: Asset.native().contractId(TESTNET.passphrase) }, { wasmHash: wasmHashes[index], publicKey: key.publicKey(), server, rpcUrl: TESTNET.rpcUrl, networkPassphrase: TESTNET.passphrase, salt: randomBytes(32), timeoutInSeconds: 180 });
    await deployment.sign({ signTransaction: sign(key) }); assert.ok(deployment.signed);
    await send(deployment.signed, `deploy-${index + 1}`);
    const cafe: CafeEntry = { name: `Workshop café ${index + 1}`, contractId: deployment.result.options.contractId, wasmHash: wasmHashes[index], owner: key.publicKey(), barista: key.publicKey(), interface: 'cafe-v1' };
    await readCafeConfig(cafe); receipt.cafes.push(cafe); save();
  }
  const [a, b] = receipt.cafes;
  async function execute(key: Keypair, action: CafeAction) {
    const operation = await prepareCafeAction(key.publicKey(), nonce(), action);
    await operation.transaction.sign({ signTransaction: sign(key) }); assert.ok(operation.transaction.signed);
    const hash = await send(operation.transaction.signed, `${action.kind}-${action.target!.name}`);
    const entity = await readConfirmedEntity(hash, action.kind, action.target!.contractId);
    return { hash, entity };
  }
  const recipe = { name: 'Workshop Orbit', category: 'coffee' as const, ingredients: ['Espresso'], description: 'A little joy across cafés.', vibe: 'Cosmic community', price_xlm: 3 };
  const rA = await execute(first, { kind: 'register', recipe, target: a });
  const rB = await execute(second, { kind: 'register', recipe, target: b });
  assert.equal(rA.entity, '1'); assert.equal(rB.entity, '1');
  await assert.rejects(readConfirmedEntity(rA.hash, 'register', b.contractId), /another café/);
  await assert.rejects(prepareCafeAction(first.publicKey(), nonce(), { kind: 'register', recipe, target: b }), /owner wallet/);
  const beforeB = await getAccountInfo(second.publicKey());
  const buyB = await execute(first, { kind: 'order', itemId: '1', priceStroops: '30000000', creator: second.publicKey(), name: recipe.name, target: b });
  assert.equal(xlmToStroops((await getAccountInfo(second.publicKey())).balance) - xlmToStroops(beforeB.balance), 30_000_000n);
  const beforeA = await getAccountInfo(first.publicKey());
  const buyA = await execute(second, { kind: 'order', itemId: '1', priceStroops: '30000000', creator: first.publicKey(), name: recipe.name, target: a });
  assert.equal(xlmToStroops((await getAccountInfo(first.publicKey())).balance) - xlmToStroops(beforeA.balance), 30_000_000n);
  const reader = createCommunityReader({ read: readCafeSnapshot, probe: async () => ({ changed: true, nextLedger: 1 }) });
  const queue = await reader([a, b], true);
  assert.equal(queue.items.length, 2); assert.equal(queue.orders.length, 2); assert.equal(new Set(queue.orders.map(o => o.id)).size, 2);
  assert.ok(queue.items.every(item => item.orders_count === 1));
  await assert.rejects(prepareCafeAction(first.publicKey(), nonce(), { kind: 'serve', orderId: buyB.entity!, name: recipe.name, target: b }), /Only this recipe/);
  await execute(first, { kind: 'serve', orderId: buyA.entity!, name: recipe.name, target: a });
  await execute(second, { kind: 'serve', orderId: buyB.entity!, name: recipe.name, target: b });
  assert.ok((await reader([a, b], true)).orders.every(order => order.status === 'Served'));
  await assert.rejects(readCafeConfig({ ...b, wasmHash: a.wasmHash }), /approved WASM/);
  receipt.verified = ['two contracts with different approved WASM hashes', 'same local IDs without collisions', 'two cross-café payments of exactly 3 XLM', 'correct creators, queues and counters', 'served in each original contract', 'wrong receipt contract rejected', 'wrong owner registration rejected', 'unauthorized serve rejected', 'wrong WASM pin rejected'];
  receipt.status = 'complete'; save(); console.log(`✓ Community rehearsal complete. ${file}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
