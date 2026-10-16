import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Registration } from './registration';
import { validateRecipe } from '../../frontend/lib/ai/recipe';
import { registrationKey } from './registration';
export const JOURNAL = 'deployments/registrations.local.json';
export function openJournal(directory = 'deployments') {
  mkdirSync(directory, { recursive: true });
  const file = join(directory, 'registrations.local.json');
  const lock = join(directory, 'registrations.lock');
  let descriptor: number;
  try { descriptor = openSync(lock, 'wx', 0o600); } catch { throw new Error(`Another registration may be running. Inspect ${lock}; after a crash, verify no process is active before removing ONLY that lock. Keep ${file}.`); }
  writeFileSync(descriptor, `${process.pid}\n`);
  const release = () => { closeSync(descriptor); unlinkSync(lock); };
  try {
    const records: Registration[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    if (!Array.isArray(records) || records.some(r => !r || r.key !== registrationKey(validateRecipe(r.recipe), r.account, r.contractId) || !['submitting', 'pending', 'unknown', 'confirmed', 'failed'].includes(r.stage) || !r.hash || !/^[a-f0-9]{64}$/.test(r.hash))) throw new Error('Invalid registration journal. Restore its backup; do not delete unresolved hashes.');
    return { records, release, save: () => {
      const temp = `${file}.tmp`;
      const fd = openSync(temp, 'w', 0o600);
      try { writeFileSync(fd, JSON.stringify(records, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temp, file);
    } };
  } catch (error) { release(); throw error; }
}
