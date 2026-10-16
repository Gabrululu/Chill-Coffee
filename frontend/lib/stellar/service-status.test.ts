import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTestnetServices, rpcFailure } from './service-status';
import { errorMessage } from './errors';
import { TESTNET } from './config';
import { getAccountInfo } from './account';
test('a 504 RPC failure identifies the provider independently of Freighter', () => {
  const message = errorMessage(rpcFailure({ response: { status: 504 }, message: 'private upstream details' }));
  assert.match(message, /Soroban RPC.*HTTP 504/); assert.match(message, /separate from your Freighter/);
  assert.doesNotMatch(message, /private upstream details|Switch Freighter/);
});
test('diagnosis distinguishes a failed RPC from healthy Horizon and checks getNetwork', async () => {
  const transport: typeof fetch = async (url, init) => {
    if (url !== TESTNET.horizonUrl) { assert.equal(JSON.parse(init!.body as string).method, 'getNetwork'); return new Response('no available server', { status: 503 }); }
    return Response.json({ network_passphrase: TESTNET.passphrase });
  };
  const status = await checkTestnetServices(transport);
  assert.equal(status.rpc.ok, false); assert.match(status.rpc.detail, /HTTP 503/); assert.equal(status.horizon.ok, true);
});
test('a reachable provider must confirm Testnet; outages never become healthy', async () => {
  for (const transport of [
    async () => Response.json({ result: { passphrase: 'Mainnet' }, network_passphrase: 'Mainnet' }),
    async () => { throw new TypeError('Failed to fetch'); },
    async () => new Response('invalid JSON'),
  ] as typeof fetch[]) {
    const status = await checkTestnetServices(transport); assert.equal(status.rpc.ok, false); assert.equal(status.horizon.ok, false);
  }
  const healthy = await checkTestnetServices(async () => Response.json({jsonrpc:'2.0',id:1, result: { passphrase: TESTNET.passphrase,protocolVersion:29 }, network_passphrase: TESTNET.passphrase }));
  assert.equal(healthy.rpc.ok, true); assert.equal(healthy.horizon.ok, true);
});
test('balance network failures identify Horizon without disconnecting the wallet', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(getAccountInfo('GAHH4R4JBNPITSHP2O4JXGGFEIJKTBA4VBNFOFKZVQRA2OHPKAF5IXTZ'), /Horizon \(balance service\).*unavailable/);
  } finally { globalThis.fetch = original; }
});
