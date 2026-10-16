import type { Category } from '../types';

export const categoryLabels: Record<Category, string> = {
  coffee: 'Hot drink',
  cold: 'Cold drink',
  experimental: 'Experimental drink',
  dessert: 'Dessert',
};
export function recipeKind(category: Category): 'drink' | 'dessert' {
  return category === 'dessert' ? 'dessert' : 'drink';
}
export function recipeArtVariant(name: string): number {
  let value = 0;
  for (const char of name) value = (Math.imul(value, 31) + char.codePointAt(0)!) >>> 0;
  return value;
}
