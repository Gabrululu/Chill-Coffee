import { recipeArtVariant } from '../cafe/recipe-kind';
import type { MenuItem as ChainItem, Order as ChainOrder, Recipe as ChainRecipe } from './generated/types';
import { StrKey } from '@stellar/stellar-sdk/base';
import { categories, type MenuItem, type Order, type Recipe } from '../types';
import { validateRecipe } from '../ai/generate-item';
import { formatStroops, xlmToStroops } from './amount';
import { WalletError } from './errors';

export const PAGE_SIZE = 10;
export const MAX_PAGES = 100;
export function chainId(value: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) throw new WalletError('invalid-id', 'Choose a real café item or order.');
  const id = BigInt(value);
  if (id > (1n << 64n) - 1n) throw new WalletError('invalid-id', 'Invalid café identifier.');
  return id;
}
function safeNumber(value: bigint, label: string): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new WalletError('invalid-data', `${label} exceeds the supported display range.`);
  return Number(value);
}
export function toChainRecipe(input: Recipe): ChainRecipe {
  let recipe: Recipe;
  try { recipe = validateRecipe(input); } catch (error) { throw new WalletError('invalid-recipe', error instanceof Error ? error.message : 'Check the recipe fields.'); }
  const encoder = new TextEncoder();
  const text = (value: string, maximum: number, label: string) => {
    if (!value.trim() || encoder.encode(value).length > maximum || /[\u0000-\u001f\u007f]/.test(value)) throw new WalletError('invalid-recipe', `${label}: use at most ${maximum} UTF-8 bytes, with no control characters.`);
    return value;
  };
  return { name: text(recipe.name, 60, 'Name'), category: recipe.category, description: text(recipe.description, 240, 'Description'), vibe: text(recipe.vibe, 80, 'Vibe'), ingredients: recipe.ingredients.map(i => text(i, 60, 'Ingredient')), price: xlmToStroops(String(recipe.price_xlm)) };
}
export function mapItem(item: ChainItem): MenuItem {
  if (!StrKey.isValidEd25519PublicKey(item.creator)) throw new WalletError('invalid-data', 'Invalid café creator address.');
  validateRecipe({ ...item, price_xlm: Number(formatStroops(item.price)) });
  if (!categories.includes(item.category as Recipe['category'])) throw new WalletError('invalid-data', 'The café returned an unsupported category.');
  return { id: item.id.toString(), creator: item.creator, name: item.name, category: item.category as Recipe['category'], ingredients: item.ingredients, vibe: item.vibe, description: item.description, price_xlm: Number(formatStroops(item.price)), price_stroops: item.price.toString(), orders_count: safeNumber(item.orders_count, 'Order count'), created_at: safeNumber(item.created_at * 1_000n, 'Timestamp'), art: recipeArtVariant(item.name) };
}
export function mapOrder(order: ChainOrder): Order {
  if (!StrKey.isValidEd25519PublicKey(order.buyer) || !StrKey.isValidEd25519PublicKey(order.creator) || order.amount <= 0n || order.amount > 50_000_000n) throw new WalletError('invalid-data', 'Invalid café order accounts or amount.');
  if (!['Pending', 'Served'].includes(order.status.tag)) throw new WalletError('invalid-data', 'The café returned an unsupported order status.');
  return { id: order.id.toString(), item_id: order.item_id.toString(), creator: order.creator, buyer: order.buyer, amount: Number(formatStroops(order.amount)), amount_stroops: order.amount.toString(), status: order.status.tag, created_at: safeNumber(order.created_at * 1_000n, 'Timestamp') };
}
export function canServe(order: Pick<Order, 'status' | 'creator'>, account: string | null, barista: string | null): boolean {
  return order.status === 'Pending' && !!account && (order.creator === account || barista === account);
}
export async function readAllPages<T extends { id: bigint }>(read: (start: bigint, limit: number) => Promise<T[]>): Promise<T[]> {
  const result: T[] = [];
  let start = 1n;
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await read(start, PAGE_SIZE);
    if (batch.length > PAGE_SIZE) throw new WalletError('invalid-page', 'The café returned an invalid page.');
    let previous = start - 1n;
    for (const item of batch) {
      if (item.id <= previous) throw new WalletError('invalid-page', 'The café returned repeated or unordered IDs.');
      previous = item.id;
    }
    result.push(...batch);
    if (batch.length < PAGE_SIZE) return result;
    start = previous + 1n;
  }
  // A bounded workshop reader: fail explicitly rather than silently omit records.
  if ((await read(start, 1)).length) throw new WalletError('cafe-capacity', 'This café has exceeded the 1,000-record workshop reader. Use an indexed deployment for a larger event.');
  return result;
}
