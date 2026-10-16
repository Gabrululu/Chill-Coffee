import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Node 22+. Private keys are managed by Stellar CLI, never loaded into this process.
if (existsSync('.env')) process.loadEnvFile('.env');
export const RPC = 'https://soroban-testnet.stellar.org/';
export const PASSPHRASE = 'Test SDF Network ; September 2015';
export const NETWORK_ARGS = ['--rpc-url', RPC, '--network-passphrase', PASSPHRASE];
export const WASM = resolve('target/wasm32v1-none/release/cafe_menu.wasm');
export const cli = process.env.STELLAR_CLI || 'stellar';

export function identity(): string {
  const name = process.env.STELLAR_IDENTITY || 'chill-cafe-testnet';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name) || /^[SG][A-Z2-7]{55}$/.test(name)) {
    throw new Error('STELLAR_IDENTITY must be a saved CLI identity name, never a secret key.');
  }
  return name;
}

export async function run(command: string, args: string[], capture = false): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
      env: { ...process.env, STELLAR_NETWORK: 'testnet', STELLAR_RPC_URL: RPC, STELLAR_NETWORK_PASSPHRASE: PASSPHRASE },
    });
    let stdout = '';
    child.stdout?.on('data', chunk => { stdout += String(chunk); });
    child.on('error', error => reject(new Error(`Cannot run ${command}: ${error.message}. Install the required tool and check PATH.`)));
    child.on('close', code => code === 0 ? resolvePromise(stdout.trim()) : reject(new Error(`${command} failed (exit ${code}). No success has been recorded; inspect the error above.`)));
  });
}

export function stellar(args: string[], capture = true): Promise<string> {
  const config = process.env.STELLAR_CONFIG_DIR;
  return run(cli, [...(config ? ['--config-dir', config] : []), ...args], capture);
}

export async function rpc<T>(method: string, params?: object): Promise<T> {
  const response = await fetch(RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Testnet RPC returned HTTP ${response.status}.`);
  const data = await response.json();
  if (data.error) throw new Error(`Testnet RPC: ${JSON.stringify(data.error)}`);
  return data.result as T;
}

export async function assertTestnet(): Promise<number> {
  const network = await rpc<{ passphrase: string; protocolVersion: number }>('getNetwork');
  if (network.passphrase !== PASSPHRASE) throw new Error('Wrong network. This workshop only supports Testnet.');
  if (network.protocolVersion < 29) throw new Error('This contract requires Testnet protocol 29 or newer.');
  return network.protocolVersion;
}

export function address(output: string): string {
  const value = output.trim().replace(/^"|"$/g, '');
  if (!/^[CG][A-Z2-7]{55}$/.test(value)) throw new Error('CLI did not return a valid public address.');
  return value;
}

export function fail(error: unknown): void {
  console.error(`\n☕ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
