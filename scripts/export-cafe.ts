import { parseArgs } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Asset, StrKey, hash } from '@stellar/stellar-sdk/base';
import { fail, WASM } from './stellar-cli';
import { selectContract } from './lib/workshop';
import { assertTestnet, getCafeClient, server } from '../frontend/lib/stellar/cafe-contract';
import { assertCompatibleWasm } from '../frontend/lib/stellar/compatibility';
import { TESTNET } from '../frontend/lib/stellar/config';
import { validateCafeEntry } from '../frontend/lib/cafe/registry-validation';
async function main() {
  const { values } = parseArgs({ options: { help: { type: 'boolean' }, name: { type: 'string' }, owner: { type: 'string' }, contract: { type: 'string' }, wasm: { type: 'string' }, output: { type: 'string' }, force: { type: 'boolean' } } });
  if (values.help) { console.log('pnpm cafe:export --name "My café" --owner G... [--contract C...] [--wasm path] [--output path] [--force]\nVerifies deployed Testnet WASM against your local build and the shared ABI; exports a public manifest. Never signs or deploys. --owner is your Freighter PUBLIC address.'); return; }
  if (!values.name || !values.owner || !StrKey.isValidEd25519PublicKey(values.owner)) throw new Error('Provide --name and --owner with your Freighter public G... address (never its secret).');
  const contractId = selectContract(values.contract);
  const localWasm = readFileSync(values.wasm ?? WASM);
  assertCompatibleWasm(localWasm);
  await assertTestnet();
  const deployed = await server.getContractWasmByContractId(contractId);
  const wasmHash = Buffer.from(hash(deployed)).toString('hex');
  if (wasmHash !== Buffer.from(hash(localWasm)).toString('hex')) throw new Error('Local build and deployed WASM differ. Build/deploy the intended contract before exporting.');
  const client = await getCafeClient(undefined, { name: values.name, contractId, wasmHash });
  const config = (await client.get_config()).result.unwrap();
  if (config.payment_token !== Asset.native().contractId(TESTNET.passphrase)) throw new Error('Only native Testnet XLM cafés can join.');
  const entry = validateCafeEntry({ name: values.name, owner: values.owner, contractId, wasmHash, barista: config.barista, interface: 'cafe-v1' });
  const file = values.output ?? 'deployments/my-cafe.local.json';
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(entry, null, 2) + '\n', { flag: values.force ? 'w' : 'wx' });
  console.log(`✓ TESTNET café manifest: ${file}\nShare this public JSON with the event host. It contains no keys.\nApproved build hash: ${wasmHash}`);
}
main().catch(fail);
