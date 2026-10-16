import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fail, run, WASM } from './stellar-cli';

async function main() {
  const output = join(mkdtempSync(join(tmpdir(), 'cafe-bindings-')), 'client');
  await run(process.execPath, ['node_modules/@stellar/stellar-sdk/bin/stellar-js', 'generate', '--wasm', WASM, '--output-dir', output, '--contract-name', 'CafeMenu']);
  const destination = 'frontend/lib/stellar/generated';
  mkdirSync(destination, { recursive: true });
  for (const file of readdirSync(join(output, 'src'))) {
    if (!file.endsWith('.ts')) continue;
    // Next.js resolves extensionless local TS imports. Only import paths change;
    // the contract specification and generated methods remain untouched.
    const source = readFileSync(join(output, 'src', file), 'utf8').replace(/(from\s+["']\.\/[^"']+)\.js(["'])/g, '$1$2');
    writeFileSync(join(destination, file), '// Generated from CafeMenu WASM. Run pnpm contract:bindings; do not edit.\n' + source + '\n');
  }
  writeFileSync(join(destination, 'provenance.json'), JSON.stringify({ wasm_sha256: createHash('sha256').update(readFileSync(WASM)).digest('hex'), generator: '@stellar/stellar-sdk', generator_version: JSON.parse(readFileSync('node_modules/@stellar/stellar-sdk/package.json', 'utf8')).version }, null, 2) + '\n');
  console.log(`✓ Contract bindings generated in ${destination}`);
}
main().catch(fail);
