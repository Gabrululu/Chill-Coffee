import { BaristaError, baristaConfig, createCafeItemProvider, type BaristaConfig, type CafeItemProvider } from './provider';
import type { Category } from '../types';
import { validatePrompt, validateGenerationCategory } from './recipe';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const failure = (error: unknown) => error instanceof BaristaError ? json({ error: error.message }, error.status) : json({ error: 'The AI Barista is unavailable. You can still edit a recipe manually.' }, 503);

// Per-process workshop budget, shared by all visitors. Never trust forwarded IP headers.
// Multi-instance public hosting needs a shared limiter at the hosting layer.
export function createBaristaHandlers(
  configuration: () => BaristaConfig = baristaConfig,
  provider: (config: BaristaConfig) => CafeItemProvider = createCafeItemProvider,
  now: () => number = Date.now,
) {
  let active = 0, requests = 0, windowStart = 0;
  return {
    GET: async () => {
      try { return json({ provider: configuration().provider, ready: true }); }
      catch { return json({ provider: 'openai', ready: false }); }
    },
    POST: async (request: Request) => {
      const origin = request.headers.get('origin');
      // Next may build request.url with its bind hostname (0.0.0.0), especially
      // behind Codespaces/HTTPS proxies. Host is the actual incoming authority.
      if (origin) {
        let allowed = false;
        try { const url = new URL(origin); allowed = ['http:', 'https:'].includes(url.protocol) && url.host === (request.headers.get('host') ?? new URL(request.url).host); } catch { /* Invalid Origin. */ }
        if (!allowed) return json({ error: 'Use the café page to generate a recipe.' }, 403);
      }
      if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'Send a JSON recipe idea.' }, 415);
      let prompt: string;
      let category: Category | undefined;
      try {
        const reader = request.body?.getReader();
        if (!reader) throw new Error('Empty body');
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 4096) { await reader.cancel(); return json({ error: 'Your idea is too long.' }, 413); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        prompt = validatePrompt(data?.prompt);
        category = validateGenerationCategory(data?.category);
      } catch { return json({ error: 'Describe your idea in 1–600 characters and choose a valid category.' }, 400); }
      try {
        const config = configuration();
        {
          const time = now();
          if (time - windowStart >= 60_000) { windowStart = time; requests = 0; }
          if (active >= 2 || requests >= 20) return json({ error: 'The AI Barista is busy. Try again in a minute.' }, 429);
          requests++;
        }
        active++;
        try { return json({ recipe: await provider(config)(prompt, request.signal, category), provider: config.provider }); }
        finally { active--; }
      } catch (error) { return failure(error); }
    },
  };
}
