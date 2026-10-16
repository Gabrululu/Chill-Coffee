import { identity, stellar, address, assertTestnet, NETWORK_ARGS, fail } from './stellar-cli';

async function main() {
  await assertTestnet();
  const name = identity();
  if (process.argv.includes('--create')) {
    // No overwrite flag: existing identities and secrets are never replaced.
    await stellar(['keys', 'generate', name, ...NETWORK_ARGS]);
  }
  const publicKey = address(await stellar(['keys', 'address', name]));
  const accountUrl = `https://horizon-testnet.stellar.org/accounts/${publicKey}`;
  const existing = await fetch(accountUrl, { signal: AbortSignal.timeout(30_000) });
  if (existing.ok) { console.log(`✓ TESTNET / No real funds\nAccount already available: ${publicKey}. Friendbot was not called.`); return; }
  if (existing.status !== 404) throw new Error(`Cannot check the Testnet account (HTTP ${existing.status}). Friendbot was not called.`);
  console.log(`TESTNET / No real funds\nFunding ${publicKey} with Friendbot…`);
  await stellar(['keys', 'fund', name, ...NETWORK_ARGS], false);
  const response = await fetch(accountUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('Friendbot funding could not be confirmed through Horizon.');
  console.log(`✓ Testnet account available: ${publicKey}`);
}
main().catch(fail);
