import { parseArgs } from 'node:util';
import { existsSync, fsyncSync, renameSync, openSync, closeSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fail, stellar, identity, address, NETWORK_ARGS } from './stellar-cli';
import { validateCafeEntry, validateDirectory } from '../frontend/lib/cafe/registry-validation';
import { readCafeConfig, server } from '../frontend/lib/stellar/cafe-contract';
import { getRegistryClient, registryConfig, readOnchainDirectory, toRegistryCafe } from '../frontend/lib/cafe/onchain-registry';
import { MAX_FEE_STROOPS, transactionUrl } from '../frontend/lib/stellar/config';
import { assertCafeAuthorization } from '../frontend/lib/stellar/authorization';
import { submitTransaction, trackTransaction, type TransactionState } from '../frontend/lib/stellar/transaction';
import { signReviewedTransaction, transactionHash } from '../frontend/lib/stellar/sign-reviewed';
const receiptFile = 'deployments/registry-update.local.json';
async function main() {
  const { values } = parseArgs({ options: { help: { type: 'boolean' }, file: { type: 'string' }, 'expected-hash': { type: 'string' }, write: { type: 'boolean' }, replace: { type: 'boolean' }, remove: { type: 'string' }, check: { type: 'boolean' } } });
  if (values.help) { console.log('HOST: pnpm cafe:add --file cafe.json --expected-hash <reviewed-sha256> [--write] [--replace]\npnpm cafe:add --remove C... [--write]\npnpm cafe:add --check\nReads the on-chain directory. --write signs a real Testnet registry update with the administrator CLI identity. Saves hash before submission; --check recovers uncertain outcomes.'); return; }
  const lock = `${receiptFile}.lock`, fd = openSync(lock, 'wx', 0o600);
  try {
    let receipt: TransactionState = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, 'utf8')) : { stage: 'idle' };
    const record = (patch: TransactionState) => { receipt = { ...receipt, ...patch }; const temp = `${receiptFile}.tmp`; const out = openSync(temp, 'w', 0o600);
      try { writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n'); fsyncSync(out); } finally { closeSync(out); }
      renameSync(temp, receiptFile); };
    if (values.check) {
      if (!receipt.hash) throw new Error('No submitted registry transaction to check.');
      // Fixed Testnet RPC and existing tracker verify network and actual confirmation.
      const { assertTestnet } = await import('../frontend/lib/stellar/cafe-contract'); await assertTestnet();
      await trackTransaction(server, receipt.hash, record);
      console.log(`${receipt.stage} · ${transactionUrl(receipt.hash)}`);
      if (receipt.stage !== 'confirmed') throw new Error('Registry update is not confirmed. Do not send another update yet.');
      return;
    }
    if (receipt.hash && !['confirmed', 'failed'].includes(receipt.stage)) throw new Error('An earlier update is unresolved. Run pnpm cafe:add --check before another update.');
    if (!!values.remove === !!values.file) throw new Error('Choose --file to add a café, or --remove to remove one.');
    const account = address(await stellar(['keys', 'address', identity()]));
    if (account !== registryConfig().admin) throw new Error('The saved identity is not the registry administrator.');
    const client = await getRegistryClient(account);
    // Read revision BEFORE snapshot: a concurrent change makes submission fail atomically.
    const revision = (await client.get_revision()).result;
    const current = await readOnchainDirectory();
    let cafes = current.cafes;
    if (values.remove) {
      if (!cafes.some(c => c.contractId === values.remove)) throw new Error('That café is not registered.');
      cafes = cafes.filter(c => c.contractId !== values.remove);
    } else {
      if (!values['expected-hash']) throw new Error('Provide the independently reviewed --expected-hash.');
      const entry = validateCafeEntry(JSON.parse(readFileSync(values.file!, 'utf8')));
      if (entry.wasmHash !== values['expected-hash']) throw new Error('Manifest differs from the reviewed WASM hash.');
      await readCafeConfig(entry);
      const old = cafes.find(c => c.contractId === entry.contractId);
      if (old && JSON.stringify(old) !== JSON.stringify(entry) && !values.replace) throw new Error('Manifest changed. Review it before using --replace.');
      if (old && JSON.stringify(old) === JSON.stringify(entry)) { console.log('✓ This exact café is already approved on-chain. No transaction sent.'); return; }
      cafes = [...cafes.filter(c => c.contractId !== entry.contractId), entry];
    }
    validateDirectory({ ...current, cafes });
    console.log(JSON.stringify({ ...current, cafes }, null, 2));
    if (!values.write) { console.log('✓ Preview only. Use --write to sign and publish this directory on Testnet.'); return; }
    // Validate every retained entry before authorizing the full replacement.
    for (const cafe of cafes) await readCafeConfig(cafe);
    const operation = await client.set_cafes({ cafes: cafes.map(toRegistryCafe), expected_revision: revision }, { timeoutInSeconds: 180 });
    if (!operation.built || operation.isReadCall || BigInt(operation.built.fee) > MAX_FEE_STROOPS) throw new Error('Invalid registry transaction or fee exceeds 1 XLM workshop limit.');
    assertCafeAuthorization(operation.built, { account, contractId: registryConfig().contractId, method: 'set_cafes' });
    const reviewedHash = transactionHash(operation.built);
    const signed = await signReviewedTransaction(operation.built, reviewedHash, account, async xdr => ({
      signedTxXdr: (await stellar(['tx', 'sign', xdr, '--sign-with-key', identity(), ...NETWORK_ARGS])).trim(), signerAddress: account,
    }));
    receipt = { stage: 'preparing', account, contractId: registryConfig().contractId };
    await submitTransaction(server, signed, record);
    if (receipt.hash) console.log(`${receipt.stage} · ${transactionUrl(receipt.hash)}`);
    if (receipt.stage !== 'confirmed') throw new Error('Registry confirmation is unresolved. Run pnpm cafe:add --check.');
    console.log('✓ Directory update confirmed on Stellar. Frontends will read it on their next refresh.');
  } finally { closeSync(fd); unlinkSync(lock); }
}
main().catch(fail);
