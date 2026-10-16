import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baristaConfig, createCafeItemProvider, BaristaError } from './provider';
import type { Recipe } from '../types';
import { createBaristaHandlers } from './http';

const config = { provider: 'openai' as const, apiKey: 'test-server-key', model: 'test-structured-model' };
const recipe = { name: 'Lúcuma Nebula', category: 'dessert', ingredients: ['Espresso', 'Lúcuma'], description: 'A cosmic treat.', vibe: 'Cozy orbit', price_xlm: 3 };
const output = (value: unknown) => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
const fake = (data: unknown, status = 200): typeof fetch => async () => Response.json(data, { status });
const request = (body: unknown, headers: Record<string, string> = {}) => new Request('http://localhost/api/barista', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('AI requires real server configuration and never falls back to mock', () => {
  for (const env of [{}, {AI_PROVIDER:'mock'}, {AI_PROVIDER:'unknown'}, {AI_PROVIDER:'openai'}, {NEXT_PUBLIC_DEMO_MODE:'true', AI_PROVIDER:'mock'}]) assert.throws(() => baristaConfig(env), BaristaError);
  assert.deepEqual(baristaConfig({OPENAI_API_KEY:' key ', OPENAI_MODEL:' model '}), {provider:'openai',apiKey:'key',model:'model'});
});
test('OpenAI adapter uses Responses structured outputs and validates the result', async () => {
  const transport: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal((init!.headers as Record<string, string>).Authorization, 'Bearer test-server-key');
    const body = JSON.parse(init!.body as string);
    assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.additionalProperties, false);
    assert.equal(body.store, false); assert.equal(body.input, 'lúcuma');
    assert.match(body.instructions, /UTF-8/); assert.ok(init!.signal);
    return Response.json(output(recipe));
  };
  assert.deepEqual(await createCafeItemProvider(config, transport)('lúcuma'), recipe);
});
test('rejects incomplete, refused, malformed and invalid model output', async () => {
  for (const data of [
    { ...output(recipe), status: 'incomplete' },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '```json\n{}\n```' }] }] },
    output({ ...recipe, price_xlm: -1 }), output({ ...recipe, name: 'é'.repeat(31) }),
    { status: 'completed', output: [] }, null,
  ]) await assert.rejects(createCafeItemProvider(config, fake(data))('idea'), BaristaError);
});
test('provider failures hide secrets; timeout and throttling have useful statuses', async () => {
  for (const status of [401, 429, 500]) {
    await assert.rejects(createCafeItemProvider(config, fake({ error: 'test-server-key' }, status))('idea'), (error: unknown) => {
      assert.ok(error instanceof BaristaError); assert.equal(error.status, status === 429 ? 429 : 502); assert.doesNotMatch(error.message, /test-server-key/); return true;
    });
  }
  const timeout: typeof fetch = async () => { throw new DOMException('secret', 'TimeoutError'); };
  await assert.rejects(createCafeItemProvider(config, timeout)('idea'), (error: unknown) => error instanceof BaristaError && error.status === 504);
});
test('route validates content type, origin, body size and prompt before calling AI', async () => {
  let calls = 0;
  const handlers = createBaristaHandlers(() => config, () => async () => { calls++; return recipe as Recipe; });
  for (const [req, status] of [
    [request({ prompt: 'hello' }, { Origin: 'https://other.example' }), 403],
    [request({ prompt: 'hello' }, { 'Content-Type': 'text/plain' }), 415],
    [request({ prompt: 'x'.repeat(5000) }), 413],
    [request({ prompt: 'x'.repeat(601) }), 400], [request({ prompt: '' }), 400], [request({ prompt: 3 }), 400],
    [new Request('http://localhost/api/barista', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), 400],
  ] as const) assert.equal((await handlers.POST(req)).status, status);
  assert.equal(calls, 0);
  const response = await handlers.POST(request({ prompt: 'lúcuma' }, { Origin: 'http://localhost' }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { recipe, provider: 'openai' }); assert.equal(calls, 1);
});
test('status endpoint discloses neither credentials nor configuration errors', async () => {
  const ready = createBaristaHandlers(() => config);
  assert.deepEqual(await (await ready.GET()).json(), { provider: 'openai', ready: true });
  const broken = createBaristaHandlers(() => { throw new BaristaError(503, 'private detail'); });
  assert.deepEqual(await (await broken.GET()).json(), { provider: 'openai', ready: false });
  const response = await broken.POST(request({ prompt: 'coffee' }));
  assert.equal(response.status, 503);
});
test('paid route limits concurrent and per-minute requests, then releases capacity', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let time = 100_000;
  const handlers = createBaristaHandlers(() => config, () => async () => { await gate; return recipe as Recipe; }, () => time);
  const first = handlers.POST(request({ prompt: 'coffee' }));
  const second = handlers.POST(request({ prompt: 'coffee' }));
  // Let both requests finish reading their bodies and enter the provider.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await handlers.POST(request({ prompt: 'coffee' }))).status, 429);
  release(); assert.equal((await first).status, 200); assert.equal((await second).status, 200);
  for (let i = 0; i < 18; i++) assert.equal((await handlers.POST(request({ prompt: 'coffee' }))).status, 200);
  assert.equal((await handlers.POST(request({ prompt: 'coffee' }))).status, 429);
  time += 60_000;
  assert.equal((await handlers.POST(request({ prompt: 'coffee' }))).status, 200);
});
test('route frees its concurrency slot after provider errors', async () => {
  const handlers = createBaristaHandlers(() => config, () => async () => { throw new BaristaError(502, 'Try again.'); });
  for (let i = 0; i < 3; i++) assert.equal((await handlers.POST(request({ prompt: 'coffee' }))).status, 502);
});

test('origin checks use incoming Host behind a bind address or HTTPS proxy', async () => {
  const handlers = createBaristaHandlers(() => config, () => async () => recipe as Recipe);
  const proxied = (origin: string) => new Request('http://0.0.0.0:3000/api/barista', { method: 'POST', headers: { Host: 'cafe.example', Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'matcha' }) });
  assert.equal((await handlers.POST(proxied('https://cafe.example'))).status, 200);
  for (const origin of ['https://evil.example', 'null', 'not-a-url']) assert.equal((await handlers.POST(proxied(origin))).status, 403);
});

test('Claude configuration uses only Anthropic credentials and requires a model', () => {
  assert.deepEqual(baristaConfig({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: ' key ', ANTHROPIC_MODEL: ' model ' }), { provider: 'anthropic', apiKey: 'key', model: 'model' });
  for (const env of [
    { AI_PROVIDER: 'anthropic', OPENAI_API_KEY: 'other', OPENAI_MODEL: 'other' },
    { AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'key' },
    { AI_PROVIDER: 'anthropic', ANTHROPIC_MODEL: 'model' },
  ]) assert.throws(() => baristaConfig(env), BaristaError);
});
const claudeConfig = { provider: 'anthropic' as const, apiKey: 'test-anthropic-key', model: 'test-claude-model' };
const claudeOutput = (value: unknown) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(value) }] });
test('Claude sends Messages structured outputs and validates the recipe', async () => {
  const transport: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    const headers = init!.headers as Record<string, string>;
    assert.equal(headers['x-api-key'], 'test-anthropic-key');
    assert.equal(headers['anthropic-version'], '2023-06-01');
    assert.equal(headers.Authorization, undefined);
    const body = JSON.parse(init!.body as string);
    assert.equal(body.model, 'test-claude-model');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'matcha' }]);
    assert.equal(body.output_config.format.type, 'json_schema');
    assert.equal(body.output_config.format.schema.additionalProperties, false);
    assert.match(body.system, /UTF-8/);
    assert.ok(init!.signal);
    return Response.json(claudeOutput(recipe));
  };
  assert.deepEqual(await createCafeItemProvider(claudeConfig, transport)('matcha'), recipe);
});
test('Claude rejects truncated, refused and invalid output and hides API errors', async () => {
  for (const data of [null, { ...claudeOutput(recipe), stop_reason: 'max_tokens' }, { stop_reason: 'refusal' }, claudeOutput({ ...recipe, price_xlm: 10 }), { stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }]) {
    await assert.rejects(createCafeItemProvider(claudeConfig, fake(data))('idea'), BaristaError);
  }
  for (const status of [401, 429, 500]) {
    await assert.rejects(createCafeItemProvider(claudeConfig, fake({ error: 'test-anthropic-key' }, status))('idea'), (error: unknown) => {
      assert.ok(error instanceof BaristaError);
      assert.equal(error.status, status === 429 ? 429 : 502);
      assert.doesNotMatch(error.message, /test-anthropic-key/);
      return true;
    });
  }
});
test('Claude route reports its selected provider', async () => {
  const handlers = createBaristaHandlers(() => claudeConfig, () => async () => recipe as Recipe);
  assert.deepEqual(await (await handlers.GET()).json(), { provider: 'anthropic', ready: true });
  assert.deepEqual(await (await handlers.POST(request({ prompt: 'matcha' }))).json(), { recipe, provider: 'anthropic' });
});

test('both providers constrain generation to the chosen dessert category and reject a different type', async () => {
  for (const selected of [config, claudeConfig]) {
    const transport: typeof fetch = async (_, init) => {
      const body = JSON.parse(init!.body as string);
      const anthropic = selected.provider === 'anthropic';
      const schema = anthropic ? body.output_config.format.schema : body.text.format.schema;
      assert.deepEqual(schema.properties.category.enum, ['dessert']);
      assert.match(anthropic ? body.system : body.instructions, /Selected category: dessert/);
      return Response.json(anthropic ? claudeOutput(recipe) : output(recipe));
    };
    assert.deepEqual(await createCafeItemProvider(selected, transport)('a coffee-flavored cake', undefined, 'dessert'), recipe);
    await assert.rejects(createCafeItemProvider(selected, fake(selected.provider === 'anthropic' ? claudeOutput({ ...recipe, category: 'coffee' }) : output({ ...recipe, category: 'coffee' })))('cake', undefined, 'dessert'), BaristaError);
  }
});
test('route passes the selected category to generation and rejects invalid types before calling AI', async () => {
  let calls = 0;
  const handlers = createBaristaHandlers(() => config, () => async (_, __, category) => { calls++; assert.equal(category, 'dessert'); return recipe as Recipe; });
  assert.equal((await handlers.POST(request({ prompt: 'cake', category: 'dessert' }))).status, 200);
  for (const category of ['unknown', null, {}, ['dessert']]) assert.equal((await handlers.POST(request({ prompt: 'cake', category }))).status, 400);
  assert.equal(calls, 1);
});
