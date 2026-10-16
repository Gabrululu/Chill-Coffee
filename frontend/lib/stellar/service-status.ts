import { TESTNET } from './config';
import { WalletError } from './errors';
import { createTestnetRpcTransport } from './rpc-transport';
export type Service = 'rpc' | 'horizon' | 'friendbot';
const labels = { rpc: 'Soroban RPC', horizon: 'Horizon (balance service)', friendbot: 'Friendbot' };
export function serviceFailure(service: Service, status?: number): WalletError {
  const http = status ? ` (HTTP ${status})` : '';
  return new WalletError(`${service}-unavailable`, `${labels[service]} on Testnet is unavailable${http}. This is separate from your Freighter connection. Try refreshing shortly; do not resend an unresolved transaction.`);
}
export function rpcFailure(error: unknown): WalletError {
  const status = error && typeof error === 'object' && 'response' in error ? (error.response as { status?: unknown } | undefined)?.status : undefined;
  return serviceFailure('rpc', typeof status === 'number' ? status : undefined);
}
export type ServiceStatus = { ok: boolean; detail: string };
export type TestnetStatus = { rpc: ServiceStatus; horizon: ServiceStatus };
export async function checkTestnetServices(transport: typeof fetch = fetch): Promise<TestnetStatus> {
  async function checkHorizon(): Promise<ServiceStatus> {
    try {
      const response = await transport(TESTNET.horizonUrl, {cache:'no-store',signal:AbortSignal.timeout(8_000)});
      if (!response.ok) return {ok:false,detail:serviceFailure('horizon',response.status).message};
      const data = await response.json();
      if (data?.network_passphrase !== TESTNET.passphrase) return {ok:false,detail:'Horizon did not confirm Stellar Testnet.'};
      return {ok:true,detail:'Horizon (balance service): Stellar Testnet confirmed.'};
    } catch { return {ok:false,detail:serviceFailure('horizon').message}; }
  }
  const rpcTransport = createTestnetRpcTransport(transport);
  const rpcCheck = async (): Promise<ServiceStatus> => {
    try {
      await rpcTransport.request({jsonrpc:'2.0',id:1,method:'getNetwork'});
      return {ok:true,detail:`Soroban RPC: Stellar Testnet confirmed via ${new URL(rpcTransport.endpoint()).hostname}.`};
    } catch (error) { return {ok:false,detail:error instanceof WalletError ? error.message : serviceFailure('rpc').message}; }
  };
  const [rpc, horizon] = await Promise.all([rpcCheck(), checkHorizon()]);
  return { rpc, horizon };
}
