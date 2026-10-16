import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const isRunning = () => new Promise(resolve => {
  const socket = createConnection({ host: '127.0.0.1', port: 3000 });
  const done = value => { socket.destroy(); resolve(value); };
  socket.once('connect', () => done(true));
  socket.once('error', () => done(false));
  socket.setTimeout(1000, () => done(false));
});

if (await isRunning()) {
  console.log('☕ El puerto 3000 ya está abierto. No se inicia un segundo servidor.');
} else {
  const log = '/tmp/stellar-chill-cafe-dev.log';
  const descriptor = openSync(log, 'a', 0o600);
  const child = spawn('pnpm', ['dev'], { cwd: workspace, detached: true, stdio: ['ignore', descriptor, descriptor] });
  let failed = false;
  child.once('error', error => { failed = true; console.error(error.message); });
  child.once('exit', () => { failed = true; });
  child.unref();
  closeSync(descriptor);
  console.log(`☕ Iniciando la página. Registro: ${log}`);
  let ready = false;
  for (let attempt = 0; attempt < 60 && !failed; attempt++) {
    if (await isRunning()) { ready = true; break; }
    await setTimeout(500);
  }
  if (ready) console.log('✓ Café disponible en el puerto 3000.');
  else {
    console.error(`La página no está disponible todavía. Revisa ${log} antes de ejecutar pnpm dev.`);
    process.exitCode = 1;
  }
}
