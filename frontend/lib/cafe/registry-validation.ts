import {StrKey} from '@stellar/stellar-sdk/base';
import {MAX_CAFES, type CafeEntry, type CafeDirectory} from './registry';
export function validateCafeEntry(value: unknown): CafeEntry {
  if (!value || typeof value !== 'object') throw new Error('Invalid café entry.');
  const r = value as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name.trim() || new TextEncoder().encode(r.name).length > 60 || /[\u0000-\u001f\u007f]/.test(r.name)) throw new Error('Café name: use 1–60 UTF-8 bytes without controls.');
  if (typeof r.contractId !== 'string' || !StrKey.isValidContract(r.contractId)) throw new Error('Invalid café contract address.');
  if (typeof r.wasmHash !== 'string' || !/^[a-f0-9]{64}$/.test(r.wasmHash)) throw new Error('Café needs an approved SHA-256 WASM hash.');
  if (typeof r.barista !== 'string' || !StrKey.isValidEd25519PublicKey(r.barista)) throw new Error('Invalid café barista account.');
  if (r.owner !== null && (typeof r.owner !== 'string' || !StrKey.isValidEd25519PublicKey(r.owner))) throw new Error('Owner must be a public G... address or null for a shared café.');
  if (r.interface !== 'cafe-v1') throw new Error('Unsupported café interface.');
  return { name: r.name.trim(), contractId: r.contractId, wasmHash: r.wasmHash, barista: r.barista, owner: r.owner as string | null, interface: 'cafe-v1' };
}
export function validateDirectory(value: unknown): CafeDirectory {
  if (!value || typeof value !== 'object') throw new Error('Invalid café directory.');
  const r = value as Record<string, unknown>;
  if (r.version !== 1 || r.network !== 'testnet' || !Array.isArray(r.cafes) || r.cafes.length > MAX_CAFES) throw new Error(`The directory requires 0–${MAX_CAFES} cafés on Testnet, version 1.`);
  const cafes = r.cafes.map(validateCafeEntry);
  if (new Set(cafes.map(c => c.contractId)).size !== cafes.length) throw new Error('Duplicate café contracts in directory.');
  return { version: 1, network: 'testnet', cafes };
}
