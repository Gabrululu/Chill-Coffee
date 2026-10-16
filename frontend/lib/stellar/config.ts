import type { CafeTarget } from '../cafe/registry';
import provenance from './generated/provenance.json';
import deployment from '../../../deployments/testnet.json';

// The workshop never accepts RPC URLs or passphrases from a browser wallet.
export const TESTNET = {
  passphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org/',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  friendbotUrl: 'https://friendbot.stellar.org',
} as const;
export const CAFE_CONTRACT_ID = process.env.NEXT_PUBLIC_CAFE_CONTRACT_ID || deployment.contract_id;
export const TIP_STROOPS = 1_000_000n;
export const MAX_FEE_STROOPS = 10_000_000n;
export const transactionUrl = (hash: string) => {
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Invalid transaction hash.');
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
};

// Standalone/legacy CLI target. The shared event UI passes approved directory entries explicitly.
export const DEFAULT_CAFE: CafeTarget = { name: "Stellar Chill Café", contractId: CAFE_CONTRACT_ID, wasmHash: provenance.wasm_sha256 };
