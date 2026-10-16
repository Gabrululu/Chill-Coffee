import { TESTNET } from './config';
import { WalletError } from './errors';
// Public Testnet endpoints, documented by SDF and Gateway.fm. No wallet-supplied URL.
export const TESTNET_RPC_URLS = [TESTNET.rpcUrl, 'https://rpc.testnet.stellar.gateway.fm/'] as const;
const READ_METHODS = new Set(['getNetwork', 'getHealth', 'getVersionInfo', 'getLatestLedger', 'getLedgerEntries', 'getTransaction', 'getTransactions', 'getEvents', 'getLedgers', 'getFeeStats', 'simulateTransaction']);
type RpcBody = { jsonrpc: string; id: unknown; method: string; params?: unknown };
type RpcReply = { jsonrpc?: string; id?: unknown; result?: unknown; error?: unknown };
export function createTestnetRpcTransport(transport: typeof fetch = fetch, now: () => number = Date.now, endpoints: readonly string[] = TESTNET_RPC_URLS) {
  let active = 0;
  const verified = new Map<string, number>(), unavailable = new Map<string, number>();
  const verifying = new Map<string, Promise<RpcReply>>();
  async function post(url: string, body: RpcBody): Promise<RpcReply> {
    const response = await transport(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(6_000), redirect: 'manual' });
    if (!response.ok) throw new WalletError('rpc-unavailable', `Testnet RPC ${new URL(url).hostname} returned HTTP ${response.status}.`);
    const reply = await response.json();
    if (!reply || reply.jsonrpc !== '2.0' || reply.id !== body.id || (!('result' in reply) && !('error' in reply))) throw new WalletError('rpc-invalid-response', 'The Testnet RPC returned an invalid response.');
    return reply;
  }
  async function verify(url: string, force: boolean): Promise<RpcReply | null> {
    if (!force && verified.has(url) && now() - verified.get(url)! < 30_000) return null;
    if (!verifying.has(url)) {
      const job = (async () => {
        const reply = await post(url, { jsonrpc: '2.0', id: 1, method: 'getNetwork' });
        const network = reply.result as { passphrase?: string; protocolVersion?: number } | undefined;
        if (network?.passphrase !== TESTNET.passphrase || Number(network.protocolVersion) < 29 || !Number.isFinite(Number(network.protocolVersion))) throw new WalletError('wrong-rpc', 'The RPC did not confirm Stellar Testnet protocol 29 or newer. Nothing was sent.');
        verified.set(url, now()); return reply;
      })();
      verifying.set(url, job);
      void job.finally(() => verifying.delete(url)).catch(() => {});
    }
    return verifying.get(url)!;
  }
  async function request(body: RpcBody): Promise<RpcReply> {
    const indices = [active, ...endpoints.map((_, index) => index).filter(index => index !== active)];
    let lastError: unknown;
    for (const index of indices) {
      const url = endpoints[index];
      if ((unavailable.get(url) ?? 0) > now()) continue;
      let network: RpcReply | null;
      try { network = await verify(url, body.method === 'getNetwork'); }
      catch (error) { lastError = error; unavailable.set(url, now() + 30_000); verified.delete(url); continue; }
      active = index;
      if (body.method === 'getNetwork' && network) return { ...network, id: body.id };
      // Only known read methods may be retried. A send timeout is ambiguous;
      // never forward the same signed transaction to a second provider here.
      if (!READ_METHODS.has(body.method)) {
        try { return await post(url, body); }
        catch (error) { unavailable.set(url, now() + 30_000); verified.delete(url); throw error; }
      }
      try { return await post(url, body); }
      catch (error) { lastError = error; unavailable.set(url, now() + 30_000); verified.delete(url); }
    }
    throw lastError ?? new WalletError('rpc-unavailable', 'The Testnet RPC providers are temporarily unavailable. Try again shortly; check saved transaction hashes before retrying a payment.');
  }
  return { request, endpoint: () => endpoints[active] };
}
