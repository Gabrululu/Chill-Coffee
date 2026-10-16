import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cafeBoard, cafeChanges, changeMessage } from './board';
import type { MenuItem, Order } from '../types';
const now = 2_000_000;
const item = (id: string, count = 0, creator = 'creator'): MenuItem => ({ id, name: `Cup ${id}`, category: 'coffee', ingredients: ['Espresso'], description: 'A cozy cup.', vibe: 'Cosmic', price_xlm: 3, art: 0, orders_count: count, creator, created_at: 1_000 });
const order = (id: string, item_id: string, created_at: number, status: Order['status'] = 'Pending'): Order => ({ id, item_id, created_at, status, buyer: 'buyer', creator: 'creator', amount: 3 });

test('trending uses its time window, deduplicates orders, and ignores future or missing items', () => {
  const items = [item('1', 20), item('2', 5)];
  const recent = order('1', '2', now - 60_000);
  const orders = [recent, recent, order('2', '2', now - 120_000, 'Served'), order('3', '1', now - 16 * 60_000), order('4', '1', now + 1), order('5', 'missing', now)];
  const short = cafeBoard({ items, orders }, now, 15);
  assert.deepEqual(short.trending.map(i => i.id), ['2']); assert.equal(short.recent.get('2'), 2);
  assert.deepEqual(cafeBoard({ items, orders }, now, 30).trending.map(i => i.id), ['2', '1']);
  assert.equal(short.totalOrders, 25); // Lifetime counts never come from the recent window.
  assert.equal(short.latestOrders.length, 4);
  assert.equal(items[0].id, '1'); assert.equal(orders.length, 6); // Input data stays untouched.
});
test('time-window cutoff is inclusive and served orders still count as orders', () => {
  const board = cafeBoard({ items: [item('1')], orders: [order('1', '1', now - 900_000, 'Served'), order('2', '1', now - 900_001)] }, now, 15);
  assert.equal(board.recent.get('1'), 1); assert.equal(board.pending, 1); assert.equal(board.served, 1);
});
test('rankings and newest resolve same-ledger u64 IDs without losing precision', () => {
  const a = item('9007199254740992', 3), b = item('9007199254740993', 3);
  const board = cafeBoard({ items: [a, b], orders: [] }, now);
  assert.deepEqual(board.ranked.map(i => i.id), [b.id, a.id]); assert.equal(board.latest[0].id, b.id);
  assert.deepEqual(cafeBoard({ items: [b, a], orders: [] }, now).ranked, board.ranked);
});
test('top creator aggregates menu counts; zero orders produce no podium or creator award', () => {
  const board = cafeBoard({ items: [item('1', 3, 'alice'), item('2', 4, 'alice'), item('3', 6, 'bob')], orders: [] }, now);
  assert.deepEqual(board.topCreator, { address: 'alice', count: 7, creations: 2 });
  const empty = cafeBoard({ items: [item('1')], orders: [] }, now);
  assert.equal(empty.topCreator, undefined); assert.equal(empty.favorites.length, 0); assert.equal(empty.ranked.length, 1);
  assert.equal(cafeBoard({ items: [], orders: [] }, now).latest[0], undefined);
});
test('changes only announce newly observed records and real Pending to Served transitions', () => {
  const before = { items: [item('1', 1)], orders: [order('1', '1', now)] };
  assert.equal(changeMessage(cafeChanges(null, before)), '');
  const after = { items: [item('1', 2), item('2')], orders: [order('1', '1', now, 'Served'), order('2', '1', now)] };
  const changes = cafeChanges(before, after);
  assert.deepEqual(changes, { items: ['1', '2'], newItems: 1, newOrders: 1, served: 1 });
  assert.equal(changeMessage(changes), '1 new creation · 1 new order · 1 served');
  assert.equal(changeMessage(cafeChanges(after, after)), '');
  assert.equal(changeMessage(cafeChanges(after, { items: [], orders: [] })), '');
  assert.equal(cafeChanges(before, { ...after, orders: [...after.orders, ...after.orders] }).newOrders, 1);
});

