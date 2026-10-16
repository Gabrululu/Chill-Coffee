import { contract, xdr } from '@stellar/stellar-sdk';
import { Client } from './generated/client';
import { TESTNET, DEFAULT_CAFE } from './config';
const text = (value: { toString(): string }) => value.toString();
function definition(entry: xdr.ScSpecEntry): { key: string; shape: string } | null {
  if (entry.type === 'scSpecEntryFunctionV0') {
    const fn = entry.value;
    return { key: `fn:${text(fn.name)}`, shape: JSON.stringify([fn.inputs.map(i => [text(i.name), i.type.toXdr('base64')]), fn.outputs.map(o => o.toXdr('base64'))]) };
  }
  if (entry.type === 'scSpecEntryUdtStructV0') {
    const struct = entry.value;
    return { key: `type:${text(struct.name)}`, shape: JSON.stringify(struct.fields.map(f => [text(f.name), f.type.toXdr('base64')])) };
  }
  if (entry.type === 'scSpecEntryUdtUnionV0') {
    const union = entry.value;
    return { key: `type:${text(union.name)}`, shape: JSON.stringify(union.cases.map(c => c.type === 'scSpecUdtUnionCaseVoidV0' ? [text(c.value.name)] : [text(c.value.name), c.value.type.map(t => t.toXdr('base64'))])) };
  }
  if (entry.type === 'scSpecEntryUdtErrorEnumV0') {
    const enumeration = entry.value;
    return { key: `type:${text(enumeration.name)}`, shape: JSON.stringify(enumeration.cases.map(c => [text(c.name), c.value])) };
  }
  return null; // Additional events and private storage types are allowed.
}
export function assertCompatibleSpec(candidate: contract.Spec, expected?: contract.Spec): void {
  const base = expected ?? new Client({ contractId: DEFAULT_CAFE.contractId, networkPassphrase: TESTNET.passphrase, rpcUrl: TESTNET.rpcUrl }).spec;
  const actual = new Map<string, string>();
  for (const entry of candidate.entries) {
    const d = definition(entry);
    if (!d) continue;
    if (actual.has(d.key)) throw new Error(`Duplicate ABI definition ${d.key}.`);
    actual.set(d.key, d.shape);
  }
  for (const entry of base.entries) {
    const required = definition(entry);
    if (required && actual.get(required.key) !== required.shape) throw new Error(`Incompatible café interface: ${required.key}. Keep the shared function signatures, data types and error codes.`);
  }
}
export function assertCompatibleWasm(wasm: Uint8Array) { assertCompatibleSpec(contract.Spec.fromWasm(wasm)); }
