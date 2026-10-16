// Server / CLI only. The JSON contains bootstrap addresses, never a menu or directory.
import { contract, hash, StrKey } from '@stellar/stellar-sdk';
import deployment from '../../../deployments/registry-testnet.json';
import { server, assertTestnet } from '../stellar/cafe-contract';
import { TESTNET } from '../stellar/config';
import type {CafeEntry} from './registry';
import {validateDirectory} from './registry-validation';

type ChainCafe = { name: string; contract_id: string; wasm_hash: Uint8Array; barista: string; owner?: string; interface_version: number };
type RegistryMethods = {
  get_admin: () => Promise<contract.AssembledTransaction<string>>;
  get_revision: () => Promise<contract.AssembledTransaction<bigint>>;
  get_cafes: () => Promise<contract.AssembledTransaction<ChainCafe[]>>;
  set_cafes: (args: { cafes: ChainCafe[]; expected_revision: bigint }, options?: contract.MethodOptions) => Promise<contract.AssembledTransaction<null>>;
};
export function registryConfig() {
  const contractId = process.env.CAFE_REGISTRY_CONTRACT_ID || deployment.contract_id;
  const wasmHash = process.env.CAFE_REGISTRY_WASM_HASH || deployment.wasm_sha256;
  const admin = process.env.CAFE_REGISTRY_ADMIN || deployment.admin;
  if (!StrKey.isValidContract(contractId) || !/^[a-f0-9]{64}$/.test(wasmHash) || !StrKey.isValidEd25519PublicKey(admin)) throw new Error('Configure the deployed Testnet CafeRegistry address, reviewed WASM hash and admin. Run pnpm registry:deploy.');
  return { contractId, wasmHash, admin };
}
export async function getRegistryClient(publicKey?: string) {
  const config = registryConfig();
  await assertTestnet();
  const wasm = await server.getContractWasmByContractId(config.contractId);
  const digest = Array.from(hash(wasm), b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== config.wasmHash) throw new Error('Registry code differs from the approved WASM hash.');
  const client = await contract.Client.fromWasm<RegistryMethods>(wasm, { ...config, rpcUrl: TESTNET.rpcUrl, networkPassphrase: TESTNET.passphrase, server, publicKey });
  if ((await client.get_admin()).result !== config.admin) throw new Error('Registry administrator differs from the approved deployment.');
  return client;
}
export const toRegistryCafe = (entry: CafeEntry): ChainCafe => ({ name: entry.name, contract_id: entry.contractId, wasm_hash: Uint8Array.from(entry.wasmHash.match(/../g)!, byte => parseInt(byte, 16)), barista: entry.barista, owner: entry.owner ?? undefined, interface_version: 1 });
export async function readOnchainDirectory() {
  const client = await getRegistryClient();
  // A single call returns an atomic bounded snapshot of the directory.
  const entries = (await client.get_cafes()).result;
  return validateDirectory({ version: 1, network: 'testnet', cafes: entries.map(entry => ({ name: entry.name, contractId: entry.contract_id, wasmHash: Array.from(entry.wasm_hash, b => b.toString(16).padStart(2, '0')).join(''), barista: entry.barista, owner: entry.owner ?? null, interface: entry.interface_version === 1 ? 'cafe-v1' : 'unsupported' })) });
}
