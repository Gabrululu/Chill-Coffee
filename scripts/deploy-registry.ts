import { createHash, randomBytes } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { identity, stellar, address, assertTestnet, NETWORK_ARGS, fail } from './stellar-cli';
const file = 'deployments/registry-testnet.local.json';
const wasm = 'target/wasm32v1-none/release/cafe_registry.wasm';
function savePlan(plan: object) {
  const temp = `${file}.tmp`, fd = openSync(temp, 'w', 0o644);
  try { writeFileSync(fd, JSON.stringify(plan, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, file);
}
async function main() {
  if (process.argv.includes('--help')) { console.log('pnpm registry:deploy [--verify]\nDeploys an empty Testnet registry owned by STELLAR_IDENTITY. Keeps a deterministic deployment plan; --verify recovers a timed-out deploy. Public configuration: deployments/registry-testnet.local.json.'); return; }
  await assertTestnet();
  const source = identity(), admin = address(await stellar(['keys', 'address', source]));
  const wasmHash = createHash('sha256').update(readFileSync(wasm)).digest('hex');
  let plan: { network: string; status: string; admin: string; wasm_sha256: string; contract_id: string; salt: string };
  if (existsSync(file)) {
    plan = JSON.parse(readFileSync(file, 'utf8'));
    if (plan.admin !== admin || plan.wasm_sha256 !== wasmHash || plan.network !== 'testnet') throw new Error('Existing registry deployment differs from this identity/build. Preserve the record before intentionally creating another registry.');
  } else {
    const salt = randomBytes(32).toString('hex');
    const contractId = address(await stellar(['contract', 'id', 'wasm', '--salt', salt, '--source-account', source, ...NETWORK_ARGS]));
    plan = { network: 'testnet', status: 'planned', admin, wasm_sha256: wasmHash, contract_id: contractId, salt };
    savePlan(plan);
  }
  console.log(`TESTNET / No real funds\nRegistry: ${plan.contract_id}\nAdmin: ${admin}`);
  if (plan.status !== 'confirmed' && !process.argv.includes('--verify')) {
    const deployed = address(await stellar(['contract', 'deploy', '--wasm', wasm, '--salt', plan.salt, '--source-account', source, ...NETWORK_ARGS, '--', '--admin', admin]));
    if (deployed !== plan.contract_id) throw new Error('Unexpected deployment address.');
  }
  process.env.CAFE_REGISTRY_CONTRACT_ID = plan.contract_id;
  process.env.CAFE_REGISTRY_WASM_HASH = plan.wasm_sha256;
  process.env.CAFE_REGISTRY_ADMIN = plan.admin;
  const { getRegistryClient } = await import('../frontend/lib/cafe/onchain-registry');
  await getRegistryClient();
  plan.status = 'confirmed'; savePlan(plan);
  console.log(`✓ Confirmed registry and administrator. Add these server-only settings to root .env and frontend/.env.local:\nCAFE_REGISTRY_CONTRACT_ID=${plan.contract_id}\nCAFE_REGISTRY_WASM_HASH=${plan.wasm_sha256}\nCAFE_REGISTRY_ADMIN=${plan.admin}`);
}
const lock = `${file}.lock`;
async function run() {
  const fd = openSync(lock, 'wx', 0o600);
  try { await main(); } finally { closeSync(fd); unlinkSync(lock); }
}
run().catch(fail);
