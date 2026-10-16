import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { identity, stellar, address, assertTestnet, NETWORK_ARGS, fail } from './stellar-cli';

type RecordValue = Record<string, unknown>;
async function invoke(contractId: string, signer: string, fn: string, args: string[], read = false): Promise<RecordValue> {
  return JSON.parse(await stellar([
    'contract', 'invoke', '--id', contractId, '--source-account', signer,
    ...NETWORK_ARGS, ...(read ? ['--send', 'no'] : []), '--', fn, ...args,
  ])) as RecordValue;
}
async function latestHash(publicKey: string): Promise<string> {
  const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}/transactions?order=desc&limit=1`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('Could not verify transaction history on Horizon.');
  const transaction = (await response.json())._embedded.records[0];
  if (!transaction?.successful) throw new Error('Latest test account transaction was not successful.');
  return transaction.hash;
}

async function main() {
  console.log('☕ Live Testnet smoke test: registers one item, orders it, serves it, and tips 0.1 XLM.');
  console.log('Uses two dedicated CLI identities. No Freighter or frontend integration in Phase 2.');
  await assertTestnet();
  const deployment = JSON.parse(readFileSync('deployments/testnet.local.json', 'utf8'));
  if (deployment.status !== 'confirmed' || deployment.network !== 'testnet') throw new Error('Run contract:deploy and verify its Testnet deployment first.');
  const contractId = address(deployment.contract_id);
  const creatorIdentity = identity();
  const buyerIdentity = process.env.STELLAR_BUYER_IDENTITY || 'chill-cafe-buyer';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(buyerIdentity) || /^[SG][A-Z2-7]{55}$/.test(buyerIdentity)) throw new Error('Use a saved CLI buyer identity name.');
  const creator = address(await stellar(['keys', 'address', creatorIdentity]));
  const buyer = address(await stellar(['keys', 'address', buyerIdentity]));
  if (creator === buyer) throw new Error('Creator and buyer must be different dedicated Testnet identities.');
  const config = await invoke(contractId, creatorIdentity, 'get_config', [], true);
  const token = address(await stellar(['contract', 'id', 'asset', '--asset', 'native', ...NETWORK_ARGS]));
  assert.equal(config.payment_token, token, 'Contract must use native Testnet XLM');
  const balance = async (account: string) => BigInt(String(await invoke(token, creatorIdentity, 'balance', ['--id', account], true)));
  const totalBefore = BigInt(String(await stellar(['contract', 'invoke', '--id', contractId, '--source-account', creatorIdentity, ...NETWORK_ARGS, '--send', 'no', '--', 'get_tip_total'])).replaceAll('"',''));
  const recipe = { name: 'Phase 2 Testnet Espresso', category: 'coffee', ingredients: ['Espresso', 'Stardust (fictional)'], vibe: 'A verified little orbit', description: 'Live Testnet rehearsal. No real funds.', price: '10000000' };
  const item = await invoke(contractId, creatorIdentity, 'register_item', ['--creator', creator, '--recipe', JSON.stringify(recipe)]);
  const registrationHash = await latestHash(creator);
  assert.equal(item.creator, creator); assert.equal(String(item.orders_count), '0');
  const creatorBeforeOrder = await balance(creator);
  const requestId = randomBytes(32).toString('hex');
  const order = await invoke(contractId, buyerIdentity, 'order_item', ['--buyer', buyer, '--item_id', String(item.id), '--expected_price', recipe.price, '--request_id', requestId]);
  const orderHash = await latestHash(buyer);
  assert.equal((await balance(creator)) - creatorBeforeOrder, 10_000_000n, 'Creator must receive exactly 1 native XLM');
  assert.equal(String(order.amount), recipe.price); assert.equal(order.creator, creator); assert.equal(order.buyer, buyer);
  const served = await invoke(contractId, creatorIdentity, 'mark_served', ['--order_id', String(order.id), '--served_by', creator]);
  const servedHash = await latestHash(creator);
  assert.ok(JSON.stringify(served.status).includes('Served'));
  const updated = await invoke(contractId, creatorIdentity, 'get_item', ['--id', String(item.id)], true);
  assert.equal(String(updated.orders_count), '1');
  const baristaBeforeTip = await balance(String(config.barista));
  await stellar(['contract', 'invoke', '--id', contractId, '--source-account', buyerIdentity, ...NETWORK_ARGS, '--', 'tip_barista', '--buyer', buyer, '--amount', '1000000', '--request_id', randomBytes(32).toString('hex')]);
  const tipHash = await latestHash(buyer);
  assert.equal((await balance(String(config.barista))) - baristaBeforeTip, 1_000_000n, 'Barista must receive exactly 0.1 native XLM');
  const totalAfter = BigInt(String(await stellar(['contract', 'invoke', '--id', contractId, '--source-account', creatorIdentity, ...NETWORK_ARGS, '--send', 'no', '--', 'get_tip_total'])).replaceAll('"',''));
  assert.equal(totalAfter - totalBefore, 1_000_000n);
  const result = { network: 'testnet', contract_id: contractId, creator, buyer, item_id: item.id, order_id: order.id, transactions: { registration: registrationHash, order: orderHash, served: servedHash, tip: tipHash }, confirmed_at: new Date().toISOString() };
  writeFileSync('deployments/smoke-testnet.local.json', JSON.stringify(result, null, 2) + '\n');
  console.log('✓ Live registration, XLM payment, counter, service and tip confirmed.');
  console.log(JSON.stringify(result, null, 2));
  console.log('History hashes assume these dedicated accounts are not used concurrently by another process.');
}
main().catch(fail);
