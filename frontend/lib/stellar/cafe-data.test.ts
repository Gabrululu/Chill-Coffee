import { Keypair } from '@stellar/stellar-sdk/base';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chainId, toChainRecipe, mapItem, mapOrder, canServe, readAllPages, PAGE_SIZE, MAX_PAGES } from './cafe-data';
import type { Recipe } from '../types';
const recipe: Recipe = { name: 'Lúcuma Nebula', category: 'dessert', ingredients: ['Lúcuma', 'Espresso'], vibe: 'Cosmic chill', description: 'A little joy.', price_xlm: 3.0000001 };
test('recipe conversion validates UTF-8 byte bounds and preserves exact stroops', () => {
  assert.equal(toChainRecipe(recipe).price, 30_000_001n);
  assert.throws(() => toChainRecipe({ ...recipe, name: 'é'.repeat(31) }), /UTF-8/);
  assert.throws(() => toChainRecipe({ ...recipe, vibe: 'space\ncoffee' }), /control/);
  assert.throws(() => toChainRecipe({ ...recipe, ingredients: ['é'.repeat(31)] }), /UTF-8/);
  assert.throws(() => toChainRecipe({ ...recipe, price_xlm: 1.12345678 }), /7 places/);
});
test('demo and invalid IDs never become contract calls; u64 IDs retain precision', () => {
  for (const id of ['demo-42','0','-1','1.5','1e2','', '18446744073709551616']) assert.throws(() => chainId(id));
  assert.equal(chainId('9007199254740993'), 9_007_199_254_740_993n);
});
test('maps chain items and orders without inventing transaction hashes', () => {
  const item = mapItem({ ...toChainRecipe(recipe), id: 9_007_199_254_740_993n, creator: Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(1)).publicKey(), orders_count: 2n, created_at: 1000n });
  assert.equal(item.id,'9007199254740993'); assert.equal(item.price_stroops,'30000001'); assert.equal(item.created_at,1_000_000);
  const order = mapOrder({ id: 4n, item_id: 9_007_199_254_740_993n, buyer: Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(2)).publicKey(), creator: Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(1)).publicKey(), amount: 30_000_001n, status: { tag: 'Pending', values: undefined }, created_at: 1001n });
  assert.equal(order.item_id,item.id); assert.equal(order.amount_stroops,'30000001'); assert.equal(order.status,'Pending'); assert.equal(order.hash,undefined);
});
test('serving permissions are limited to pending orders and creator/event barista', () => {
  const order = { status: 'Pending' as const, creator: 'creator' };
  assert.equal(canServe(order, 'creator', 'host'), true);
  assert.equal(canServe(order, 'host', 'host'), true);
  assert.equal(canServe(order, 'buyer', 'host'), false);
  assert.equal(canServe(order, null, 'host'), false);
  assert.equal(canServe({ ...order, status: 'Served' }, 'host', 'host'), false);
});
test('reads every page in order and stops on a short page', async () => {
  const entries = Array.from({ length: 23 }, (_, index) => ({ id: BigInt(index + 1) }));
  const starts: bigint[] = [];
  const all = await readAllPages(async (start, limit) => { starts.push(start); assert.equal(limit, PAGE_SIZE); return entries.filter(item => item.id >= start).slice(0,limit); });
  assert.equal(all.length,23); assert.deepEqual(starts,[1n,11n,21n]);
  assert.deepEqual(await readAllPages(async () => []), []);
});
test('rejects repeated pages and explicit capacity overflow instead of dropping records', async () => {
  await assert.rejects(readAllPages(async () => [{ id: 0n }]), /unordered/);
  await assert.rejects(readAllPages(async () => [{ id: 1n },{ id: 1n }]), /repeated/);
  let calls = 0;
  await assert.rejects(readAllPages(async (start, limit) => { calls++; return Array.from({ length: limit }, (_, i) => ({ id: start + BigInt(i) })); }), /1,000-record/);
  assert.equal(calls,MAX_PAGES+1);
});
test('event probes advance only on a successful read; outages require a full refresh', async () => {
  const { probeCafeChanges } = await import('./cafe-contract');
  type EventServer = Parameters<typeof probeCafeChanges>[1];
  const unchanged = { getEvents: async () => ({ events: [], latestLedger: 200 }) } as unknown as EventServer;
  assert.deepEqual(await probeCafeChanges(190,unchanged),{ changed:false,nextLedger:201 });
  const changed = { getEvents: async () => ({ events: [{ ledger:195 }], latestLedger:200 }) } as unknown as EventServer;
  assert.equal((await probeCafeChanges(190,changed)).changed,true);
  const unavailable = { getEvents: async () => { throw new Error('expired cursor or offline'); } } as unknown as EventServer;
  assert.deepEqual(await probeCafeChanges(190,unavailable),{ changed:true,nextLedger:190 });
});
test('reads more than 30 recipes across contract pages without dropping drinks or desserts', async () => {
  const records = Array.from({ length: 35 }, (_, index) => ({ id: BigInt(index + 1), category: index % 2 ? 'dessert' : 'coffee' }));
  const starts: bigint[] = [];
  const result = await readAllPages(async (start, limit) => { starts.push(start); return records.filter(item => item.id >= start).slice(0, limit); });
  assert.deepEqual(result, records);
  assert.deepEqual(starts, [1n, 11n, 21n, 31n]);
});
