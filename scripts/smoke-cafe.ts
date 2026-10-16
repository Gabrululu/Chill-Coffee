import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { prepareCafeAction, readCafeSnapshot, readConfirmedEntity, server, getCafeClient, type CafeAction } from '../frontend/lib/stellar/cafe-contract';
import { createFreighterSigner, type FreighterApi } from '../frontend/lib/stellar/wallet-session';
import { submitTransaction } from '../frontend/lib/stellar/transaction';
import { fundTestnetAccount, getAccountInfo } from '../frontend/lib/stellar/account';
import { xlmToStroops } from '../frontend/lib/stellar/amount';
import { TESTNET, CAFE_CONTRACT_ID } from '../frontend/lib/stellar/config';

const nonce = () => randomBytes(32).toString('hex');
function bridge(key: Keypair): FreighterApi {
  return {
    isConnected: async () => ({ isConnected: true }), getAddress: async () => ({ address: key.publicKey() }), requestAccess: async () => ({ address: key.publicKey() }),
    getNetworkDetails: async () => ({ network: 'TESTNET', networkPassphrase: TESTNET.passphrase, networkUrl: TESTNET.horizonUrl }),
    signTransaction: async (xdr, options) => {
      assert.equal(options?.networkPassphrase, TESTNET.passphrase); assert.equal(options.address, key.publicKey());
      const tx = TransactionBuilder.fromXdr(xdr, TESTNET.passphrase); tx.sign(key);
      return { signedTxXdr: tx.toXdr(), signerAddress: key.publicKey() };
    },
  };
}
async function execute(key: Keypair, action: CafeAction, requestId = nonce()) {
  const prepared = await prepareCafeAction(key.publicKey(), requestId, action);
  console.log(`Review: ${prepared.title} · maximum fee ${prepared.fee} stroops`);
  await prepared.transaction.sign({ signTransaction: createFreighterSigner(bridge(key), key.publicKey()) });
  assert.ok(prepared.transaction.signed);
  const result = await submitTransaction(server, prepared.transaction.signed, state => console.log(`${action.kind}: ${state.stage}${state.hash ? ` ${state.hash}` : ''}`));
  assert.equal(result.stage, 'confirmed', 'Check the saved/printed hash before retrying an uncertain submission.');
  assert.ok(result.hash);
  const entityId = await readConfirmedEntity(result.hash, action.kind);
  assert.ok(entityId);
  return { hash: result.hash, entityId, requestId };
}
async function main() {
  console.log('☕ Phase 4 café rehearsal — TESTNET. Creates an item, pays 3 XLM and serves it.');
  console.log('Two in-memory signers exercise the real frontend adapter. Browser Freighter popup is not automated.');
  const creator = Keypair.random(), buyer = Keypair.random();
  await Promise.all([fundTestnetAccount(creator.publicKey()), fundTestnetAccount(buyer.publicKey())]);
  const registration = await execute(creator, { kind: 'register', recipe: { name: 'Phase 4 Lúcuma Orbit', category: 'dessert', description: 'A confirmed little joy from the café adapter.', ingredients: ['Lúcuma', 'Espresso', 'Cacao'], vibe: 'Cozy Peruvian cosmos', price_xlm: 3 } });
  const menu = await readCafeSnapshot();
  const item = menu.items.find(i => i.id === registration.entityId);
  assert.ok(item); assert.equal(item.creator,creator.publicKey()); assert.equal(item.orders_count,0); assert.equal(item.price_stroops,'30000000');
  const orderAction: CafeAction = { kind: 'order', itemId: item.id, priceStroops: item.price_stroops, creator: item.creator, name: item.name };
  await assert.rejects(prepareCafeAction(creator.publicKey(),nonce(),orderAction), /another participant/);
  await assert.rejects(prepareCafeAction(buyer.publicKey(),nonce(),{ ...orderAction, priceStroops: '1' }), /price changed/);
  const before = await getAccountInfo(creator.publicKey());
  const ordered = await execute(buyer,orderAction);
  const after = await getAccountInfo(creator.publicKey());
  assert.equal(xlmToStroops(after.balance)-xlmToStroops(before.balance),30_000_000n);
  await assert.rejects(prepareCafeAction(buyer.publicKey(),ordered.requestId,orderAction));
  const queued = await readCafeSnapshot();
  const order = queued.orders.find(o => o.id === ordered.entityId);
  assert.ok(order); assert.equal(order.status,'Pending'); assert.equal(order.buyer,buyer.publicKey()); assert.equal(order.item_id,item.id);
  assert.equal(queued.items.find(i => i.id === item.id)?.orders_count,1);
  const serveAction: CafeAction = { kind: 'serve', orderId: order.id, name: item.name };
  await assert.rejects(prepareCafeAction(buyer.publicKey(),nonce(),serveAction), /Only this recipe/);
  const served = await execute(creator,serveAction);
  const final = await readCafeSnapshot();
  assert.equal(final.orders.find(o => o.id === order.id)?.status,'Served');
  assert.equal(final.items.find(i => i.id === item.id)?.orders_count,1);
  await assert.rejects(prepareCafeAction(creator.publicKey(),nonce(),serveAction), /already been served/);
  const client = await getCafeClient();
  assert.equal((await client.get_order({ id: BigInt(order.id) })).result.unwrap().status.tag,'Served');
  const receipt = { network: 'testnet', contract_id: CAFE_CONTRACT_ID, creator: creator.publicKey(), buyer: buyer.publicKey(), item_id: item.id, order_id: order.id, amount_stroops: '30000000', registration, order: ordered, served, verified: ['exact creator balance increment', 'menu inclusion', 'pending queue', 'order counter', 'served state', 'self-order rejection', 'stale-price rejection', 'duplicate nonce rejection', 'unauthorized serve rejection', 'double serve rejection'], signer: 'ephemeral in-memory keys through the Freighter adapter; browser extension not automated', confirmed_at: new Date().toISOString() };
  mkdirSync('deployments',{ recursive:true }); writeFileSync('deployments/cafe-testnet.local.json',JSON.stringify(receipt,null,2)+'\n');
  console.log('✓ Full café flow verified through the frontend SDK adapter.'); console.log(JSON.stringify(receipt,null,2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode=1; });
