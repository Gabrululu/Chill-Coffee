// Server adapter. Import only from server routes or CLI; never from client components.
import type { Recipe, Category } from '../types';
import { BARISTA_PROMPT } from './prompts';
import { RECIPE_SCHEMA, validatePrompt, validateGeneratedRecipe, validateGenerationCategory } from './recipe';

export class BaristaError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export type BaristaConfig = { provider: 'openai' | 'anthropic'; apiKey?: string; model?: string };
export type CafeItemProvider = (prompt: string, signal?: AbortSignal, category?: Category) => Promise<Recipe>;
export function baristaConfig(env: Record<string, string | undefined> = {
  AI_PROVIDER: process.env.AI_PROVIDER, OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_MODEL: process.env.OPENAI_MODEL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
}): BaristaConfig {
  const provider = env.AI_PROVIDER?.trim() || 'openai';
  if (provider !== 'openai' && provider !== 'anthropic') throw new BaristaError(503, 'The AI Barista provider is not configured. You can still edit a recipe manually.');
  const apiKey = (provider === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY)?.trim();
  const model = (provider === 'anthropic' ? env.ANTHROPIC_MODEL : env.OPENAI_MODEL)?.trim();
  if (!apiKey || !model) throw new BaristaError(503, 'The AI Barista needs server configuration. You can still edit a recipe manually.');
  return { provider, apiKey, model };
}

export function createCafeItemProvider(config: BaristaConfig, transport: typeof fetch = fetch): CafeItemProvider {
  return async (input, signal, requestedCategory) => {
    const prompt = validatePrompt(input);
    const category = validateGenerationCategory(requestedCategory);
    const instructions = BARISTA_PROMPT + (category ? `
Selected category: ${category}. Generate exactly this category.` : '');
    const schema = category ? { ...RECIPE_SCHEMA, properties: { ...RECIPE_SCHEMA.properties, category: { type: 'string', enum: [category] } } } : RECIPE_SCHEMA;
    if (!config.apiKey || !config.model) throw new BaristaError(503, 'The AI Barista needs server configuration.');
    try {
      const anthropic = config.provider === 'anthropic';
      const response = await transport(anthropic ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/responses', {
        method: 'POST', headers: anthropic
          ? { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
          : { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
        body: JSON.stringify(anthropic ? {
          model: config.model, system: instructions, max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
          output_config: { format: { type: 'json_schema', schema } },
        } : { model: config.model, instructions, input: prompt, store: false, max_output_tokens: 800,
          text: { format: { type: 'json_schema', name: 'cafe_item', strict: true, schema } } }),
      });
      // Provider responses may contain sensitive details: never forward their errors or log them.
      if (!response.ok) throw new BaristaError(response.status === 429 ? 429 : 502, response.status === 429 ? 'The AI Barista is busy. Try again shortly.' : 'The AI Barista could not finish your recipe. Try again or edit manually.');
      const data = await response.json();
      if (anthropic) {
        if (data?.stop_reason === 'refusal') throw new BaristaError(422, 'Try a different café idea. Your current recipe is unchanged.');
        if (data?.stop_reason !== 'end_turn' || !Array.isArray(data.content)) throw new BaristaError(502, 'The recipe was incomplete. Try a simpler idea.');
        const text = data.content.filter((part: { type?: string; text?: unknown }) => part.type === 'text' && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
        if (!text || text.length > 12_000) throw new Error('Invalid output');
        return validateGeneratedRecipe(JSON.parse(text), category);
      }
      if (data.status !== 'completed' || !Array.isArray(data.output)) throw new BaristaError(502, 'The recipe was incomplete. Try a simpler idea.');
      const parts: string[] = [];
      for (const item of data.output) {
        if (item.type !== 'message' || !Array.isArray(item.content)) continue;
        for (const part of item.content) {
          if (part.type === 'refusal') throw new BaristaError(422, 'Try a different café idea. Your current recipe is unchanged.');
          if (part.type === 'output_text' && typeof part.text === 'string') parts.push(part.text);
        }
      }
      const json = parts.join('');
      if (!json || json.length > 12_000) throw new Error('Invalid output');
      return validateGeneratedRecipe(JSON.parse(json), category);
    } catch (error) {
      if (error instanceof BaristaError) throw error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new BaristaError(504, 'The AI Barista took too long. Try again or edit manually.');
      throw new BaristaError(502, 'The AI Barista returned an invalid recipe or could not connect. Try again or edit manually.');
    }
  };
}
