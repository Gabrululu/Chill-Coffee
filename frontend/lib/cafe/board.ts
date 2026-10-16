import { newestFirst, type MenuItem, type Order } from '../types';
export type CafeData = { items: MenuItem[]; orders: Order[] };
const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const mostOrdered = (a: MenuItem, b: MenuItem) => b.orders_count - a.orders_count || newestFirst(a, b) || byId(a, b);
export const TREND_WINDOWS = [15, 30, 60] as const;

export function cafeBoard(data: CafeData, now: number, minutes = 30) {
  const ranked = [...data.items].sort(mostOrdered);
  const latest = [...data.items].sort((a, b) => newestFirst(a, b) || byId(a, b));
  const items = new Map(data.items.map(item => [item.id, item]));
  // IDs, rather than event deliveries, define orders. Repeated deliveries never count twice.
  const orders = [...new Map(data.orders.map(order => [order.id, order])).values()];
  const recent = new Map<string, number>();
  const cutoff = now - minutes * 60_000;
  for (const order of orders) if (items.has(order.item_id) && order.created_at >= cutoff && order.created_at <= now) recent.set(order.item_id, (recent.get(order.item_id) ?? 0) + 1);
  const trending = ranked.filter(item => recent.has(item.id)).sort((a, b) => recent.get(b.id)! - recent.get(a.id)! || mostOrdered(a, b));
  const creators = new Map<string, { address: string; count: number; creations: number }>();
  for (const item of data.items) {
    const entry = creators.get(item.creator) ?? { address: item.creator, count: 0, creations: 0 };
    entry.count += item.orders_count; entry.creations++; creators.set(item.creator, entry);
  }
  const topCreator = [...creators.values()].filter(creator => creator.count > 0).sort((a, b) => b.count - a.count || (a.address < b.address ? -1 : 1))[0];
  return { ranked, latest, trending, recent, topCreator, favorites: ranked.filter(item => item.orders_count > 0),
    pending: orders.filter(order => order.status === 'Pending').length,
    served: orders.filter(order => order.status === 'Served').length,
    totalOrders: data.items.reduce((total, item) => total + item.orders_count, 0),
    latestOrders: orders.filter(order => items.has(order.item_id)).sort((a, b) => newestFirst(a, b) || byId(a, b)).slice(0, 5),
  };
}
export type CafeChanges = { items: string[]; newItems: number; newOrders: number; served: number };
export function cafeChanges(previous: CafeData | null, next: CafeData): CafeChanges {
  const result: CafeChanges = { items: [], newItems: 0, newOrders: 0, served: 0 };
  if (!previous) return result;
  const oldItems = new Map(previous.items.map(item => [item.id, item]));
  const oldOrders = new Map(previous.orders.map(order => [order.id, order]));
  const changed = new Set<string>();
  for (const item of new Map(next.items.map(item => [item.id, item])).values()) {
    const before = oldItems.get(item.id);
    if (!before) { result.newItems++; changed.add(item.id); }
    else if (before.orders_count !== item.orders_count) changed.add(item.id);
  }
  for (const order of new Map(next.orders.map(order => [order.id, order])).values()) {
    const before = oldOrders.get(order.id);
    if (!before) { result.newOrders++; changed.add(order.item_id); }
    else if (before.status === 'Pending' && order.status === 'Served') { result.served++; changed.add(order.item_id); }
  }
  result.items = [...changed]; return result;
}
export function changeMessage(changes: CafeChanges): string {
  return [changes.newItems && `${changes.newItems} new creation${changes.newItems === 1 ? '' : 's'}`, changes.newOrders && `${changes.newOrders} new order${changes.newOrders === 1 ? '' : 's'}`, changes.served && `${changes.served} served`].filter(Boolean).join(' · ');
}
