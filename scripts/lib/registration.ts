import { createHash } from 'node:crypto';
import type { Transaction } from '@stellar/stellar-sdk';
import { validateRecipe } from '../../frontend/lib/ai/recipe';
import { submitTransaction, trackTransaction, type TransactionRpc, type TransactionStage } from '../../frontend/lib/stellar/transaction';
import type { Recipe, MenuItem } from '../../frontend/lib/types';
import type { PreparedOperation } from '../../frontend/lib/stellar/cafe-contract';

export type Registration = { key: string; account: string; contractId: string; recipe: Recipe; stage: TransactionStage; hash?: string; item?: MenuItem; updatedAt: string };
export const registrationKey = (recipe: Recipe, account: string, contractId: string) => createHash('sha256').update(JSON.stringify([account, contractId, validateRecipe(recipe)])).digest('hex');
type Dependencies = {
  account: string; contractId: string; records: Registration[]; save: () => void; rpc: TransactionRpc;
  prepare: (recipe: Recipe) => Promise<PreparedOperation>;
  sign: (operation: PreparedOperation) => Promise<Transaction>;
  readItem: (hash: string) => Promise<MenuItem>;
  progress: (message: string) => void;
};
export async function registerWithJournal(input: Recipe, deps: Dependencies): Promise<Registration> {
  const recipe = validateRecipe(input), key = registrationKey(recipe, deps.account, deps.contractId);
  const persist = (entry: Registration) => { entry.updatedAt = new Date().toISOString(); deps.save(); };
  // Any unresolved hash for this source/contract blocks a new operation, even if
  // the recipe has changed. A lost send response is never evidence of failure.
  for (const entry of deps.records.filter(r => r.account === deps.account && r.contractId === deps.contractId && r.hash && !['confirmed', 'failed'].includes(r.stage))) {
    deps.progress(`Checking existing transaction ${entry.hash}`);
    const state = await trackTransaction(deps.rpc, entry.hash!, state => { entry.stage = state.stage; persist(entry); });
    if (state.stage !== 'confirmed' && state.stage !== 'failed') throw new Error(`Unresolved transaction ${entry.hash}. Run the same command again to check it; no new registration was sent.`);
  }
  const previous = [...deps.records].reverse().find(r => r.key === key && r.stage === 'confirmed');
  if (previous) {
    if (!previous.item && previous.hash) { previous.item = await deps.readItem(previous.hash); persist(previous); }
    deps.progress('Already confirmed. Reusing its receipt; nothing new was sent.');
    return previous;
  }
  const operation = await deps.prepare(recipe);
  const signed = await deps.sign(operation);
  const entry: Registration = { key, account: deps.account, contractId: deps.contractId, recipe, stage: 'preparing', updatedAt: new Date().toISOString() };
  deps.records.push(entry);
  // submitTransaction calls save synchronously with the hash BEFORE sending.
  const result = await submitTransaction(deps.rpc, signed, state => {
    entry.stage = state.stage; entry.hash = state.hash; persist(entry);
    deps.progress(`${state.stage}${state.hash ? ` · ${state.hash}` : ''}`);
  });
  if (result.stage !== 'confirmed') throw new Error(`${result.stage}: ${result.error} Hash: ${result.hash}. Keep the journal and check before retrying.`);
  entry.item = await deps.readItem(result.hash!); persist(entry);
  return entry;
}
