import { fail } from './stellar-cli';
import { readOnchainDirectory } from '../frontend/lib/cafe/onchain-registry';
import { createCommunityReader } from '../frontend/lib/cafe/community';
import { readCafeSnapshot, probeCafeChanges, server } from '../frontend/lib/stellar/cafe-contract';
async function main() {
  const directory = await readOnchainDirectory();
  const read = createCommunityReader({ read: readCafeSnapshot, probe: (ledger, cafe) => probeCafeChanges(ledger, server, cafe.contractId) });
  const result = await read(directory.cafes, true);
  for (const status of result.health) console.log(`${status.error ? '✗' : '✓'} ${status.cafe.name} · ${status.cafe.contractId}${status.error ? ` · ${status.error}` : ''}`);
  console.log(`TESTNET · ${result.items.length} items · ${result.orders.length} orders · No transactions sent.`);
  if (result.degraded) throw new Error('Some cafés failed validation or could not be read. Resolve them before the event.');
}
main().catch(fail);
