import { readFileSync } from 'node:fs';
import { fail } from './stellar-cli';
import { validateRecipe } from '../frontend/lib/ai/recipe';
import { options, registerRecipes } from './lib/workshop';
async function main() {
  const opts = options();
  if (opts.help) { console.log('pnpm seed --file recipes.json [--contract C...] [--dry-run | --check] [--yes]\nRegisters YOUR recipes on Testnet using your saved CLI identity. No built-in samples.'); return; }
  if (!opts.file) throw new Error('Provide --file with your own JSON array of recipes. No sample data is generated.');
  const input: unknown = JSON.parse(readFileSync(opts.file, 'utf8'));
  if (!Array.isArray(input) || !input.length || input.length > 20) throw new Error('Provide between 1 and 20 recipes.');
  await registerRecipes(input.map(validateRecipe), opts);
}
main().catch(fail);
