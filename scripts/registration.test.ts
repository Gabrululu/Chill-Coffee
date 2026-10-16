import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openJournal } from './lib/journal';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Account, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { registerWithJournal, registrationKey, type Registration } from './lib/registration';
import type { PreparedOperation } from '../frontend/lib/stellar/cafe-contract';
import type { TransactionRpc } from '../frontend/lib/stellar/transaction';
import type { MenuItem, Recipe } from '../frontend/lib/types';
const recipe: Recipe = { name: 'Orbit', category: 'coffee', ingredients: ['Espresso'], vibe: 'Cozy', description: 'A little joy.', price_xlm: 3 };
function harness() {
  const key = Keypair.random(), account = key.publicKey(), contractId = 'test-contract';
  const tx = new TransactionBuilder(new Account(account, '0'), { fee: '100', networkPassphrase: Networks.TESTNET }).addOperation(Operation.manageData({ name: 'test', value: 'test' })).setTimeout(180).build(); tx.sign(key);
  const hash = Buffer.from(tx.hash()).toString('hex');
  const records: Registration[] = [], saves: Registration[][] = [];
  let sends = 0, preparations = 0, readFails = false, saveFails = false, status = 'SUCCESS';
  const item: MenuItem = { ...recipe, id: '42', creator: account, created_at: 1000, orders_count: 0, art: 0 };
  const deps = {
    account, contractId, records,
    save: () => { if (saveFails) throw new Error('Disk unavailable'); saves.push(JSON.parse(JSON.stringify(records))); },
    rpc: {
      sendTransaction: async () => { assert.equal(saves.at(-1)?.at(-1)?.hash, hash); sends++; return { hash, status: 'PENDING' }; },
      pollTransaction: async () => ({ status }), getTransaction: async () => ({ status }),
    } as unknown as TransactionRpc,
    prepare: async () => { preparations++; return {} as PreparedOperation; }, sign: async () => tx,
    readItem: async () => { if (readFails) throw new Error('Read unavailable'); return item; }, progress: () => {},
  };
  return { deps, hash, saves, counts: () => ({ sends, preparations }), setStatus: (next: string) => { status = next; }, setReadFails: (value: boolean) => { readFails = value; }, setSaveFails: () => { saveFails = true; } };
}
test('registration persists the hash before send and repeated runs reuse the confirmed item', async () => {
  const h = harness();
  const result = await registerWithJournal(recipe, h.deps);
  assert.equal(result.stage, 'confirmed'); assert.equal(result.item?.id, '42'); assert.equal(result.hash, h.hash);
  await registerWithJournal(recipe, h.deps); assert.deepEqual(h.counts(), { sends: 1, preparations: 1 });
});
test('uncertain sends block every new recipe for the same source and contract', async () => {
  const h = harness(); h.setStatus('NOT_FOUND');
  await assert.rejects(registerWithJournal(recipe, h.deps), /unknown/);
  await assert.rejects(registerWithJournal({ ...recipe, name: 'Another' }, h.deps), /Unresolved/);
  assert.deepEqual(h.counts(), { sends: 1, preparations: 1 });
  h.setStatus('SUCCESS'); await registerWithJournal(recipe, h.deps);
  assert.deepEqual(h.counts(), { sends: 1, preparations: 1 });
});
test('receipt lookup failures can recover without registering a duplicate', async () => {
  const h = harness(); h.setReadFails(true);
  await assert.rejects(registerWithJournal(recipe, h.deps), /Read unavailable/);
  assert.equal(h.deps.records[0].stage, 'confirmed');
  h.setReadFails(false); await registerWithJournal(recipe, h.deps);
  assert.deepEqual(h.counts(), { sends: 1, preparations: 1 });
});
test('an unwritable journal prevents transmission', async () => {
  const h = harness(); h.setSaveFails();
  await assert.rejects(registerWithJournal(recipe, h.deps), /Disk unavailable/);
  assert.equal(h.counts().sends, 0);
});
test('definitive failure permits another attempt and retains the failed receipt', async () => {
  const h = harness(); h.setStatus('FAILED');
  await assert.rejects(registerWithJournal(recipe, h.deps), /failed/);
  h.setStatus('SUCCESS'); await registerWithJournal(recipe, h.deps);
  assert.equal(h.deps.records.length, 2); assert.equal(h.deps.records[0].stage, 'failed'); assert.equal(h.counts().sends, 2);
});
test('seed resumes a partially completed list without duplicating its successful entries', async () => {
  const h = harness(); const second = { ...recipe, name: 'Second cup' };
  await registerWithJournal(recipe, h.deps);
  for (const entry of [recipe, second]) await registerWithJournal(entry, h.deps);
  assert.equal(h.counts().sends, 2);
});
test('registration keys are canonical, scoped to creator/contract and reject invalid recipes', async () => {
  assert.equal(registrationKey(recipe, 'a', 'c'), registrationKey({ ...recipe, name: ' Orbit ' }, 'a', 'c'));
  assert.notEqual(registrationKey(recipe, 'a', 'c'), registrationKey(recipe, 'b', 'c'));
  assert.notEqual(registrationKey(recipe, 'a', 'c'), registrationKey(recipe, 'a', 'd'));
  const h = harness(); await assert.rejects(registerWithJournal({ ...recipe, price_xlm: -1 }, h.deps));
  assert.equal(h.counts().preparations, 0);
});

test('file journal locks concurrent writers, persists receipts and releases after invalid JSON', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'cafe-journal-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const journal = openJournal(directory);
  assert.throws(() => openJournal(directory), /Another registration/);
  const h = harness(); await registerWithJournal(recipe, h.deps);
  journal.records.push(...h.deps.records); journal.save(); journal.release();
  const recovered = openJournal(directory);
  assert.equal(recovered.records[0].hash, h.hash); assert.equal(recovered.records[0].item?.id, '42'); recovered.release();
  writeFileSync(join(directory, 'registrations.local.json'), '{bad');
  assert.throws(() => openJournal(directory));
  assert.equal(existsSync(join(directory, 'registrations.lock')), false);
});
