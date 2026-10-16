import type { MenuItem, Order } from '../types';

const rehearsalCafe = 'CCWWU2UY5WAO7WXBRXHZQA7AHSDE6FMNZOFPKG3AECKEP5MY7QAAADYP';
// Hide only the requested rehearsal records. Contract-scoped IDs preserve
// unrelated creations, including future recipes with the same names.
const hiddenItems = new Set([
  `${rehearsalCafe}:1`, // Phase 2 Testnet Espresso
  `${rehearsalCafe}:2`, // Phase 4 Lúcuma Orbit
  `${rehearsalCafe}:3`, // Workshop Orbit Affogato
]);

export function visibleCafeData(data: { items: MenuItem[]; orders: Order[] }) {
  return {
    items: data.items.filter(item => !hiddenItems.has(item.id)),
    orders: data.orders.filter(order => !hiddenItems.has(order.item_id)),
  };
}
