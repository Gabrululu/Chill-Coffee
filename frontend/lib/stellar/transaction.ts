import type { Transaction, rpc } from '@stellar/stellar-sdk';
import { WalletError } from './errors';

export type TransactionStage = 'idle' | 'review' | 'preparing' | 'awaiting-signature' | 'submitting' | 'pending' | 'confirmed' | 'failed' | 'unknown';
export type OperationKind = 'tip' | 'register' | 'order' | 'serve';
export type TransactionState = { cafeName?: string; reviewedHash?: string; kind?: OperationKind; operationId?: string; title?: string; amountStroops?: string; itemId?: string; orderId?: string; entityId?: string; stage: TransactionStage; hash?: string; error?: string; fee?: string; requestId?: string; account?: string; contractId?: string; destination?: string };
export const IDLE: TransactionState = { stage: 'idle' };
export type Progress = (state: TransactionState) => void;
export const transactionBusy = (stage: TransactionStage) => ['preparing', 'awaiting-signature', 'submitting', 'pending'].includes(stage);

// Small injectable boundary: tests verify submission/confirmation failure modes
// without a browser extension, while production uses the official RPC SDK.
export type TransactionRpc = Pick<rpc.Server, 'sendTransaction' | 'getTransaction' | 'pollTransaction'>;
export type ConfirmationLookup = (hash: string) => Promise<'confirmed' | 'failed' | null>;
export async function trackTransaction(server: TransactionRpc, hash: string, onProgress: Progress, lookup?: ConfirmationLookup): Promise<TransactionState> {
  if (lookup) {
    let stage: 'confirmed' | 'failed' | null = null;
    try { stage = await lookup(hash); } catch { /* A secondary service outage is inconclusive. */ }
    if (stage) {
      const state: TransactionState = { stage, hash, error: stage === 'failed' ? 'Stellar confirmed that this transaction failed. Network fees may have been charged.' : undefined };
      onProgress(state); return state;
    }
  }
  try {
    const result = await server.pollTransaction(hash, { attempts: 8, sleepStrategy: () => 3_000 });
    if (result.status === 'SUCCESS') {
      const state: TransactionState = { stage: 'confirmed', hash };
      onProgress(state); return state;
    }
    if (result.status === 'FAILED') {
      const state: TransactionState = { stage: 'failed', hash, error: 'Stellar confirmed that this transaction failed. No café changes or payment were applied; network fees may have been charged.' };
      onProgress(state); return state;
    }
  } catch { /* A transport error is not proof the transaction failed. */ }
  const state: TransactionState = { stage: 'unknown', hash, error: 'Confirmation is taking longer. Check this transaction before attempting another operation.' };
  onProgress(state); return state;
}

export async function submitTransaction(server: TransactionRpc, signed: Transaction, onProgress: Progress, lookup?: ConfirmationLookup): Promise<TransactionState> {
  const hash = Array.from(signed.hash(), byte => byte.toString(16).padStart(2, '0')).join('');
  // Persist hash BEFORE sending: a dropped HTTP response can still mean success.
  onProgress({ stage: 'submitting', hash });
  let response;
  try { response = await server.sendTransaction(signed); }
  catch {
    const state: TransactionState = { stage: 'unknown', hash, error: 'The send response was interrupted. Stellar may have received it. Check the transaction before retrying.' };
    onProgress(state); return state;
  }
  if (response.hash !== hash) throw new WalletError('hash-mismatch', 'RPC returned an unexpected transaction hash. Check the original hash before retrying.');
  if (response.status === 'ERROR') {
    const state: TransactionState = { stage: 'failed', hash, error: 'Stellar rejected this transaction. Refresh your account and review the wallet before trying again.' };
    onProgress(state); return state;
  }
  // TRY_AGAIN_LATER is ambiguous. Do not silently resubmit or create a new nonce.
  if (response.status === 'TRY_AGAIN_LATER') {
    const state: TransactionState = { stage: 'unknown', hash, error: 'Stellar is busy. Check this transaction before attempting another operation.' };
    onProgress(state); return state;
  }
  onProgress({ stage: 'pending', hash });
  return trackTransaction(server, hash, onProgress, lookup);
}
