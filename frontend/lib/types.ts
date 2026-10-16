export const categories = ['coffee', 'dessert', 'cold', 'experimental'] as const;
export type Category = typeof categories[number];
export type Recipe = { name: string; category: Category; ingredients: string[]; vibe: string; price_xlm: number; description: string };
export type CafeOrigin = { cafe_id?: string; cafe_name?: string; chain_id?: string };
export type MenuItem = Recipe & CafeOrigin & { id: string; creator: string; price_stroops?: string; orders_count: number; created_at: number; art: number };
export type Order = CafeOrigin & { id: string; item_id: string; buyer: string; creator: string; amount: number; status: 'Pending' | 'Served'; created_at: number; hash?: string; amount_stroops?: string };
export const short = (address: string) => address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
// Multiple creations may share one ledger timestamp. IDs break that tie exactly.
export function newestFirst(a: Pick<MenuItem, 'id' | 'created_at'>, b: Pick<MenuItem, 'id' | 'created_at'>): number {
  const time = b.created_at - a.created_at;
  if (time) return time;
  const [aScope, aLocal] = a.id.includes(':') ? a.id.split(':') : ['', a.id];
  const [bScope, bLocal] = b.id.includes(':') ? b.id.split(':') : ['', b.id];
  if (aScope !== bScope || !/^\d+$/.test(aLocal) || !/^\d+$/.test(bLocal)) return 0;
  return BigInt(aLocal) > BigInt(bLocal) ? -1 : BigInt(aLocal) < BigInt(bLocal) ? 1 : 0;
}
