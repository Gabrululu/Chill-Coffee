import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomBytes } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk/base';
import { address, identity, stellar, NETWORK_ARGS } from '../stellar-cli';
import { validateRecipe } from '../../frontend/lib/ai/recipe';
import type { Recipe } from '../../frontend/lib/types';
import { openJournal } from './journal';
import { registerWithJournal } from './registration';

import { signReviewedTransaction } from '../../frontend/lib/stellar/sign-reviewed';
export const itemFile = 'frontend/config/my_item.json';
export function readRecipe(file = itemFile): Recipe { return validateRecipe(JSON.parse(readFileSync(file, 'utf8'))); }
export function options() {
  const parsed = parseArgs({ options: { help: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, yes: { type: 'boolean' }, check: { type: 'boolean' }, file: { type: 'string' }, contract: { type: 'string' } } }).values;
  if (parsed['dry-run'] && parsed.check) throw new Error('Choose --dry-run or --check, not both.');
  return parsed;
}
export function selectContract(explicit?: string): string {
  let contractId = explicit || process.env.NEXT_PUBLIC_CAFE_CONTRACT_ID;
  if (!contractId && existsSync('deployments/testnet.local.json')) {
    const local = JSON.parse(readFileSync('deployments/testnet.local.json', 'utf8'));
    if (local.network !== 'testnet' || local.status !== 'confirmed') throw new Error('Local deployment is not confirmed. Run pnpm contract:deploy --verify before registering.');
    contractId = local.contract_id;
  }
  if (!contractId) contractId = JSON.parse(readFileSync('deployments/testnet.json', 'utf8')).contract_id;
  if (!StrKey.isValidContract(contractId!)) throw new Error('Choose a valid Testnet contract ID.');
  process.env.NEXT_PUBLIC_CAFE_CONTRACT_ID = contractId;
  return contractId!;
}
export async function confirm(question: string, yes = false) {
  if (yes) return;
  if (!stdin.isTTY) throw new Error('Interactive approval required. Use --yes only after reviewing the output, or --dry-run for offline validation.');
  const terminal = createInterface({ input: stdin, output: stdout });
  try { if ((await terminal.question(`${question} [y/N] `)).trim().toLowerCase() !== 'y') throw new Error('Cancelled. Nothing new was signed or sent.'); }
  finally { terminal.close(); }
}
export async function registerRecipes(recipes: Recipe[], opts: ReturnType<typeof options>) {
  if (opts['dry-run']) { console.log('✓ Offline validation only. No identity, signature or RPC required.'); console.log(JSON.stringify(recipes, null, 2)); return; }
  const contractId = selectContract(opts.contract), name = identity();
  const account = address(await stellar(['keys', 'address', name]));
  if (!StrKey.isValidEd25519PublicKey(account)) throw new Error('The CLI identity must be a G... account.');
  // Load adapters only AFTER root .env / selected deployment have been applied.
  const { prepareCafeAction, readConfirmedEntity, getCafeClient, server, readCafeConfig } = await import('../../frontend/lib/stellar/cafe-contract');
  const { transactionUrl, DEFAULT_CAFE } = await import('../../frontend/lib/stellar/config');
  const { mapItem } = await import('../../frontend/lib/stellar/cafe-data');
  const local = existsSync('deployments/testnet.local.json') ? JSON.parse(readFileSync('deployments/testnet.local.json', 'utf8')) : null;
  const target = local?.contract_id === contractId && local.status === 'confirmed' ? { name: 'My workshop café', contractId, wasmHash: String(local.wasm_sha256), barista: String(local.barista) } : { ...DEFAULT_CAFE, contractId };
  await readCafeConfig(target);
  console.log(`TESTNET / No real funds\nIdentity: ${name}\nCreator: ${account}\nContract: ${contractId}`);
  const journal = openJournal();
  try {
    if (opts.check) {
      const { trackTransaction } = await import('../../frontend/lib/stellar/transaction');
      for (const entry of journal.records.filter(r => r.account === account && r.contractId === contractId)) {
        if (entry.stage !== 'confirmed' && entry.stage !== 'failed') await trackTransaction(server, entry.hash!, state => { entry.stage = state.stage; entry.updatedAt = new Date().toISOString(); journal.save(); });
        console.log(`${entry.stage} · ${entry.recipe.name} · ${entry.hash}`);
      }
      if (journal.records.some(r => r.account === account && r.contractId === contractId && !['confirmed', 'failed'].includes(r.stage))) throw new Error('Some transactions remain unresolved. Nothing new was sent.');
      return;
    }
    for (const recipe of recipes) {
      const entry = await registerWithJournal(recipe, {
        account, contractId, ...journal, rpc: server, progress: console.log,
        prepare: async recipe => {
          const prepared = await prepareCafeAction(account, randomBytes(32).toString('hex'), { kind: 'register', recipe, target });
          console.log(JSON.stringify(recipe, null, 2)); console.log(`Network fee ceiling: ${prepared.fee} stroops. No item payment; registration only.`);
          await confirm(`Sign and register ${recipe.name} with saved identity ${name}?`, opts.yes);
          return prepared;
        },
        sign: async operation => signReviewedTransaction(operation.transaction.built, operation.reviewedHash, account, async xdr => ({
          signedTxXdr: (await stellar(['tx', 'sign', xdr, '--sign-with-key', name, ...NETWORK_ARGS])).trim(), signerAddress: account,
        })),
        readItem: async hash => {
          const id = await readConfirmedEntity(hash, 'register', contractId);
          if (!id) throw new Error('Confirmed registration has no item ID. Keep the receipt and rerun to read it.');
          const client = await getCafeClient(undefined, target); return mapItem((await client.get_item({ id: BigInt(id) })).result.unwrap());
        },
      });
      console.log(`✓ Confirmed item #${entry.item?.id}\nTransaction: ${entry.hash}\n${transactionUrl(entry.hash!)}`);
      console.log(JSON.stringify(entry.item, null, 2));
    }
    console.log('✓ Keep deployments/registrations.local.json to resume safely.');
  } finally { journal.release(); }
}
