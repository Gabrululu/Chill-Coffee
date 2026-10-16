import { fail } from './stellar-cli';
import { options, readRecipe, registerRecipes } from './lib/workshop';
async function main() {
  const opts = options();
  if (opts.help) { console.log('pnpm register:item [--file path] [--contract C...] [--dry-run | --check] [--yes]\nDefault: validates my_item.json, simulates, asks approval, signs via saved Stellar CLI identity and registers on Testnet. Repeated runs reuse confirmed receipts. --check only checks recorded hashes.'); return; }
  await registerRecipes(opts.check ? [] : [readRecipe(opts.file)], opts);
}
main().catch(fail);
