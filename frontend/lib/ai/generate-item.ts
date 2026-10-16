import type { Recipe, Category } from '../types';
import { validatePrompt, validateGeneratedRecipe, validateGenerationCategory } from './recipe';
export { validateRecipe } from './recipe';
export type BaristaStatus = { provider: 'openai' | 'anthropic'; ready: boolean };

// Browser facade. Credentials and provider selection stay behind the same-origin route.
export async function generateCafeItem(prompt: string, signal?: AbortSignal, category?: Category): Promise<Recipe> {
  const valid = validatePrompt(prompt);
  const selectedCategory = validateGenerationCategory(category);
  const response = await fetch('/api/barista', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: valid, ...(selectedCategory ? { category: selectedCategory } : {}) }), signal: signal ?? AbortSignal.timeout(25_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The AI Barista is taking a break. Try again shortly.');
  return validateGeneratedRecipe(data.recipe, selectedCategory);
}
