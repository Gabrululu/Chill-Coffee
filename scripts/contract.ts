import { fail, run, cli } from './stellar-cli';

async function main() {
  switch (process.argv[2]) {
    case 'build':
      console.log('☕ Building CafeMenu for wasm32v1-none (locked dependencies)…');
      await run(cli, ['contract', 'build', '--package', 'cafe_menu', '--locked']);
      await run(cli, ['contract', 'build', '--package', 'cafe_registry', '--locked']);
      break;
    case 'test':
      console.log('☕ Testing CafeMenu, authorization and atomic SAC transfers…');
      await run('cargo', ['test', '--locked', '--workspace']);
      break;
    case 'check':
      await run('cargo', ['fmt', '--all', '--', '--check']);
      await run('cargo', ['clippy', '--locked', '--workspace', '--all-targets', '--', '-D', 'warnings']);
      break;
    default: throw new Error('Use contract:build, contract:test or contract:check.');
  }
  console.log('✓ CafeMenu check completed.');
}
main().catch(fail);
