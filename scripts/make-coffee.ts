import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { fail } from './stellar-cli';
import { baristaConfig, createCafeItemProvider } from '../frontend/lib/ai/provider';
import { itemFile } from './lib/workshop';
async function main() {
  const { values } = parseArgs({ options: { prompt: { type: 'string' }, write: { type: 'boolean' }, help: { type: 'boolean' } } });
  if (values.help) { console.log('pnpm make:coffee --prompt "A cosmic café idea" [--write]\nPrints validated recipe JSON. --write replaces frontend/config/my_item.json. Uses root .env AI settings; requires OPENAI_API_KEY and OPENAI_MODEL. Never registers or signs.'); return; }
  if (!values.prompt) throw new Error('Describe your idea with --prompt "A cosmic café idea".');
  const config = baristaConfig();
  console.log(`☕ OpenAI Barista · Fictional recipe · No blockchain transaction`);
  const recipe = await createCafeItemProvider(config)(values.prompt);
  const json = JSON.stringify(recipe, null, 2) + '\n'; console.log(json);
  if (values.write) { writeFileSync(itemFile, json); console.log(`✓ Saved ${itemFile}. Review and edit before registering.`); }
}
main().catch(fail);
