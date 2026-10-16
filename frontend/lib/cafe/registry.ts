import { WalletError } from '../stellar/errors';
export type CafeTarget = { name: string; contractId: string; wasmHash: string; barista?: string; owner?: string | null };
export type CafeEntry = CafeTarget & { barista: string; owner: string | null; interface: 'cafe-v1' };
export type CafeDirectory = { version: 1; network: 'testnet'; cafes: CafeEntry[] };
export const MAX_CAFES = 20;
export const cafeFingerprint = (cafe: CafeTarget) => JSON.stringify([cafe.contractId, cafe.wasmHash, cafe.barista ?? null, cafe.owner ?? null]);
export async function fetchDirectory(signal?: AbortSignal): Promise<CafeDirectory> {
  const response = await fetch('/api/cafes', { cache: 'no-store', signal: signal ?? AbortSignal.timeout(20_000) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new WalletError('directory-unavailable', `The event café directory is unavailable. ${typeof body?.error === 'string' ? body.error : 'Keeping the last approved list.'}`);
  }
  const body = await response.json();
  if (body?.version === 1 && body.network === 'testnet' && Array.isArray(body.cafes) && body.cafes.length === 0) return {version:1,network:'testnet',cafes:[]};
  const {validateDirectory} = await import('./registry-validation');
  return validateDirectory(body);
}
export async function requireCurrentApproval(target: CafeTarget): Promise<void> {
  const directory = await fetchDirectory();
  if (!directory.cafes.some(cafe => cafeFingerprint(cafe) === cafeFingerprint(target))) throw new Error('This café changed or left the event. Refresh and review again before signing.');
}
