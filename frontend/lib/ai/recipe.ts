import { categories, type Recipe, type Category } from '../types';

export function validatePrompt(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 600 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error('Describe your idea in 1–600 characters, without control characters.');
  return value.trim();
}

export function validateRecipe(value: unknown): Recipe {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Recipe must be an object.');
  const r = value as Record<string, unknown>;
  const text = (input: unknown, max: number, label: string): string => {
    if (typeof input !== 'string' || !input.trim() || new TextEncoder().encode(input).length > max || /[\u0000-\u001f\u007f]/.test(input)) throw new Error(`${label}: use 1–${max} UTF-8 bytes, without control characters.`);
    return input.trim();
  };
  const name = text(r.name, 60, 'Name');
  const vibe = text(r.vibe, 80, 'Vibe');
  const description = text(r.description, 240, 'Description');
  if (!categories.includes(r.category as Recipe['category'])) throw new Error('Choose a valid category.');
  if (typeof r.price_xlm !== 'number' || !Number.isFinite(r.price_xlm) || r.price_xlm < 1 || r.price_xlm > 5) throw new Error('Price must be between 1 and 5 XLM.');
  if (!/^\d+(\.\d{1,7})?$/.test(String(r.price_xlm))) throw new Error('Use a price with at most 7 places.');
  if (!Array.isArray(r.ingredients) || !r.ingredients.length || r.ingredients.length > 8) throw new Error('Use 1–8 ingredients.');
  // Return only recipe fields: provider-controlled creators, IDs and other extras never propagate.
  return { name, category: r.category as Recipe['category'], description, vibe, price_xlm: r.price_xlm, ingredients: r.ingredients.map(i => text(i, 60, 'Ingredient')) };
}

export const RECIPE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    name: { type: 'string' }, category: { type: 'string', enum: [...categories] },
    description: { type: 'string' }, ingredients: { type: 'array', items: { type: 'string' } },
    vibe: { type: 'string' }, price_xlm: { type: 'number' },
  },
  required: ['name', 'category', 'description', 'ingredients', 'vibe', 'price_xlm'],
} as const;

export function validateGenerationCategory(value: unknown): Category | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !categories.includes(value as Category)) throw new Error('Choose a valid recipe category.');
  return value as Category;
}
export function validateGeneratedRecipe(value: unknown, category?: Category): Recipe {
  const recipe = validateRecipe(value);
  if (category && recipe.category !== category) throw new Error('The generated recipe does not match the selected category. Try again.');
  return recipe;
}
