import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { identity, stellar, address, assertTestnet, NETWORK_ARGS, WASM, RPC, PASSPHRASE, fail } from './stellar-cli';

type Plan = { network: string; source: string; barista: string; payment_token: string; salt: string; contract_id: string; wasm_sha256: string; status: 'planned' | 'confirmed' };
const file = 'deployments/testnet.local.json';

async function main() {
  console.log('☕ Deploying CafeMenu — TESTNET ONLY / No real funds');
  if (!existsSync(WASM)) throw new Error('WASM not found. Run pnpm contract:build first.');
  const protocol = await assertTestnet();
  const source = identity();
  const sourceAddress = address(await stellar(['keys', 'address', source]));
  const barista = process.env.STELLAR_BARISTA_ADDRESS || sourceAddress;
  if (!/^G[A-Z2-7]{55}$/.test(barista)) throw new Error('STELLAR_BARISTA_ADDRESS must be a public Stellar account address.');
  const token = address(await stellar(['contract', 'id', 'asset', '--asset', 'native', ...NETWORK_ARGS]));
  const hash = createHash('sha256').update(readFileSync(WASM)).digest('hex');
  let plan: Plan;
  if (existsSync(file)) {
    plan = JSON.parse(readFileSync(file, 'utf8')) as Plan;
    if (plan.network !== 'testnet' || plan.source !== sourceAddress || plan.barista !== barista || plan.payment_token !== token || plan.wasm_sha256 !== hash) {
      throw new Error('Existing deployment plan differs from this build/config. Keep its record and move it to another filename before an intentional new deployment.');
    }
  } else {
    const salt = randomBytes(32).toString('hex');
    const contractId = address(await stellar(['contract', 'id', 'wasm', '--salt', salt, '--source-account', source, ...NETWORK_ARGS]));
    plan = { network: 'testnet', source: sourceAddress, barista, payment_token: token, salt, contract_id: contractId, wasm_sha256: hash, status: 'planned' };
    mkdirSync('deployments', { recursive: true });
    writeFileSync(file, JSON.stringify(plan, null, 2) + '\n');
  }
  console.log(`Protocol ${protocol}\nNative XLM SAC: ${token}\nBarista: ${barista}\nContract: ${plan.contract_id}`);

  // Retry uses the same deterministic address. A timeout can be resolved with --verify.
  const checkArgs = ['contract', 'invoke', '--id', plan.contract_id, '--source-account', source, ...NETWORK_ARGS, '--send', 'no', '--', 'get_config'];
  const verifyCode = async () => {
    const deployedHash = (await stellar(['contract', 'info', 'hash', '--id', plan.contract_id, ...NETWORK_ARGS])).trim().replace(/^"|"$/g, '');
    if (deployedHash !== hash) throw new Error('Deployed WASM hash differs from the local build.');
  };
  if (plan.status === 'confirmed') {
    await verifyCode();
    const config = JSON.parse(await stellar(checkArgs));
    if (config.barista !== barista || config.payment_token !== token) throw new Error('On-chain config differs from the deployment record.');
    console.log('✓ Existing deployment verified.');
    return;
  }
  // Deploying with the same salt cannot create a second instance. If an earlier attempt
  // already succeeded but the local record stayed planned, verify it with --verify.
  if (!process.argv.includes('--verify')) {
    const contractId = address(await stellar([
      'contract', 'deploy', '--wasm', WASM, '--salt', plan.salt,
      '--source-account', source, ...NETWORK_ARGS, '--', '--barista', barista, '--payment_token', token,
    ]));
    if (contractId !== plan.contract_id) throw new Error('Unexpected contract ID from deployment.');
  }
  await verifyCode();
  const config = JSON.parse(await stellar(checkArgs));
  if (config.barista !== barista || config.payment_token !== token) throw new Error('On-chain config verification failed.');
  plan.status = 'confirmed';
  writeFileSync(file, JSON.stringify({ ...plan, rpc_url: RPC, network_passphrase: PASSPHRASE, confirmed_at: new Date().toISOString() }, null, 2) + '\n');
  console.log(`✓ Deployment confirmed and read back from Testnet.\nhttps://stellar.expert/explorer/testnet/contract/${plan.contract_id}\nPublic deployment record: ${file}\nExport this café manifest and ask the host to approve it in the on-chain registry. Regenerate bindings after contract changes.`);
}
main().catch(fail);
