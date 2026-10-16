import type { MenuItem, Order } from '../types';
import { cafeFingerprint, type CafeEntry, type CafeTarget } from './registry';
import type { readCafeSnapshot } from '../stellar/cafe-contract';
export type Snapshot = Awaited<ReturnType<typeof readCafeSnapshot>>;
export type CafeHealth = { cafe: CafeEntry; error: string | null; lastUpdated: number | null; retryAt: number | null };
export function scopeSnapshot(cafe: CafeTarget, snapshot: Pick<Snapshot, 'items' | 'orders'>) {
  const origin = { cafe_id: cafe.contractId, cafe_name: cafe.name };
  return {
    items: snapshot.items.map(item => ({ ...item, ...origin, chain_id: item.id, id: `${cafe.contractId}:${item.id}` })),
    orders: snapshot.orders.map(order => ({ ...order, ...origin, chain_id: order.id, id: `${cafe.contractId}:${order.id}`, item_id: `${cafe.contractId}:${order.item_id}` })),
  };
}
type Cached = { fingerprint: string; snapshot?: Snapshot; error: string | null; failures: number; retryAt: number | null; checked: number | null; full: number };
export function createCommunityReader(deps: {
  read: (cafe: CafeEntry) => Promise<Snapshot>;
  probe: (ledger: number, cafe: CafeEntry) => Promise<{ changed: boolean; nextLedger: number }>;
  now?: () => number;
}) {
  const cache = new Map<string, Cached>(), now = deps.now ?? Date.now;
  return async (cafes: CafeEntry[], force = false) => {
    for (const key of cache.keys()) if (!cafes.some(cafe => cafe.contractId === key)) cache.delete(key);
    let cursor = 0;
    async function worker() {
      while (cursor < cafes.length) {
        const cafe = cafes[cursor++], fingerprint = cafeFingerprint(cafe);
        let state = cache.get(cafe.contractId);
        if (!state || state.fingerprint !== fingerprint) { state = { fingerprint, error: null, failures: 0, retryAt: null, checked: null, full: 0 }; cache.set(cafe.contractId, state); }
        if (!force && state.retryAt && now() < state.retryAt) continue;
        try {
          let changed = true;
          if (!force && state.snapshot && now() - state.full < 300_000) {
            const probe = await deps.probe(state.snapshot.nextLedger, cafe);
            changed = probe.changed;
            if (!changed) state.snapshot = { ...state.snapshot, nextLedger: probe.nextLedger };
          }
          if (changed) { state.snapshot = await deps.read(cafe); state.full = now(); }
          state.error = null; state.failures = 0; state.retryAt = null; state.checked = now();
        } catch (error) {
          state.failures++;
          state.retryAt = now() + Math.min(120_000, 30_000 * 2 ** Math.min(state.failures, 2));
          state.error = error instanceof Error ? error.message : 'Café unavailable.';
        }
      }
    }
    // Bounded parallelism: a slow or broken café cannot starve the full directory.
    await Promise.all([worker(), worker()]);
    const items: MenuItem[] = [], orders: Order[] = [], health: CafeHealth[] = [];
    for (const cafe of cafes) {
      const state = cache.get(cafe.contractId)!;
      health.push({ cafe, error: state.error, lastUpdated: state.checked, retryAt: state.retryAt });
      if (state.snapshot) {
        const scoped = scopeSnapshot(cafe, state.snapshot);
        items.push(...scoped.items); orders.push(...scoped.orders);
      }
    }
    return { items, orders, health, success: health.length === 0 || health.some(cafe => !cafe.error), degraded: health.some(cafe => !!cafe.error) };
  };
}
