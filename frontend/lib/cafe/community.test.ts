import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, StrKey } from '@stellar/stellar-sdk/base';
import {requireCurrentApproval, type CafeEntry} from './registry';
import {validateDirectory,validateCafeEntry} from './registry-validation';
import { createCommunityReader, scopeSnapshot, type Snapshot } from './community';
import { cafeBoard } from './board';
const owner = Keypair.random().publicKey();
const cafe = (n: number): CafeEntry => ({ name: `Café ${n}`, contractId: StrKey.encodeContract(new Uint8Array(32).fill(n)), wasmHash: String(n).repeat(64), barista: owner, owner, interface: 'cafe-v1' });
const snapshot = (): Snapshot => ({ barista: owner, nextLedger: 100, items: [{ id: '1', name: 'Orbit', category: 'coffee', ingredients: ['Espresso'], description: 'Cozy.', vibe: 'Lofi', price_xlm: 3, orders_count: 1, creator: owner, created_at: 1000, art: 0 }], orders: [{ id: '1', item_id: '1', creator: owner, buyer: owner, amount: 3, created_at: 1000, status: 'Pending' }] });
test('directory validates network, identities, pins, ABI version, capacity and duplicate contracts', () => {
  assert.equal(validateDirectory({ version: 1, network: 'testnet', cafes: [cafe(1), cafe(2)] }).cafes.length, 2);
  for (const patch of [{ wasmHash: '' }, { owner: 'secret' }, { contractId: owner }, { interface: 'anything' }, { name: 'é'.repeat(31) }]) assert.throws(() => validateCafeEntry({ ...cafe(1), ...patch }));
  for (const value of [{ version: 1, network: 'mainnet', cafes: [cafe(1)] }, { version: 1, network: 'testnet', cafes: [cafe(1), cafe(1)] }, { version: 1, network: 'testnet', cafes: Array(21).fill(cafe(1)) }]) assert.throws(() => validateDirectory(value));
});
test('identical local item/order IDs remain isolated across cafés and trending/queue join correctly', () => {
  const a = scopeSnapshot(cafe(1), snapshot()), b = scopeSnapshot(cafe(2), snapshot());
  const board = cafeBoard({ items: [...a.items, ...b.items], orders: [...a.orders, ...b.orders] }, 2000);
  assert.notEqual(a.items[0].id, b.items[0].id); assert.equal(a.orders[0].item_id, a.items[0].id);
  assert.equal(board.trending.length, 2); assert.equal(board.pending, 2); assert.equal(board.totalOrders, 2);
  assert.equal(a.items[0].chain_id, '1');
});
test('one failed café retains last good data without hiding healthy cafés; recovery is independent', async () => {
  let failed = false, time = 1000;
  const reader = createCommunityReader({ now: () => time, probe: async () => ({ changed: true, nextLedger: 101 }), read: async target => { if (failed && target.contractId === cafe(1).contractId) throw new Error('Temporarily unavailable'); return snapshot(); } });
  await reader([cafe(1), cafe(2)], true); failed = true;
  const degraded = await reader([cafe(1), cafe(2)], true);
  assert.equal(degraded.items.length, 2); assert.equal(degraded.health.filter(h => h.error).length, 1); assert.equal(degraded.success, true);
  failed = false; time += 60_001;
  assert.equal((await reader([cafe(1), cafe(2)])).degraded, false);
});
test('removed or repinned cafés never retain old data under a new identity', async () => {
  let fail = false;
  const reader = createCommunityReader({ probe: async () => ({ changed: false, nextLedger: 101 }), read: async () => { if (fail) throw new Error('Bad code'); return snapshot(); } });
  await reader([cafe(1), cafe(2)], true); fail = true;
  const result = await reader([{ ...cafe(1), wasmHash: 'f'.repeat(64) }], true);
  assert.equal(result.items.length, 0); assert.equal(result.health.length, 1); assert.equal(result.degraded, true);
});
test('reader uses at most two concurrent cafés and unchanged probes skip full reads', async () => {
  let active = 0, maximum = 0, reads = 0;
  const reader = createCommunityReader({ now: () => 1000, read: async () => { active++; maximum = Math.max(maximum, active); reads++; await new Promise(resolve => setImmediate(resolve)); active--; return snapshot(); }, probe: async () => ({ changed: false, nextLedger: 101 }) });
  const cafes = [cafe(1), cafe(2), cafe(3)]; await reader(cafes, true); await reader(cafes);
  assert.equal(maximum, 2); assert.equal(reads, 3);
});


test('signing approval requires a fresh directory with the exact reviewed pin and identities', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ version: 1, network: 'testnet', cafes: [cafe(1)] });
    await requireCurrentApproval(cafe(1));
    await assert.rejects(requireCurrentApproval(cafe(2)), /left the event/);
    await assert.rejects(requireCurrentApproval({ ...cafe(1), wasmHash: 'f'.repeat(64) }), /changed/);
    await assert.rejects(requireCurrentApproval({ ...cafe(1), owner: Keypair.random().publicKey() }), /changed/);
    globalThis.fetch = async () => Response.json({ error: 'Unavailable' }, { status: 503 });
    await assert.rejects(requireCurrentApproval(cafe(1)), /directory is unavailable/);
  } finally { globalThis.fetch = original; }
});

test('a confirmed empty on-chain directory is healthy and never invents cafés or records', async () => {
  const reader = createCommunityReader({read: async () => {throw new Error('No café should be called');}, probe: async () => {throw new Error('No café should be called');}});
  const result = await reader(validateDirectory({version:1,network:'testnet',cafes:[]}).cafes);
  assert.deepEqual(result, {items:[],orders:[],health:[],success:true,degraded:false});
});
