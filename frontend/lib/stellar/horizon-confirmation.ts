import { Transaction, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { TESTNET } from './config';
export type ChainConfirmation = 'confirmed' | 'failed' | null;
// Read-only recovery. A missing response/404 never means the transaction failed.
export async function readHorizonConfirmation(hash: string, transport: typeof fetch = fetch): Promise<ChainConfirmation> {
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  try {
    const response = await transport(`${TESTNET.horizonUrl}/transactions/${hash}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.hash !== hash || typeof data.successful !== 'boolean' || !Number.isSafeInteger(data.ledger) || data.ledger <= 0 || typeof data.envelope_xdr !== 'string') return null;
    const envelope = TransactionBuilder.fromXdr(data.envelope_xdr, TESTNET.passphrase);
    if (!(envelope instanceof Transaction) || envelope.source !== data.source_account || Array.from(envelope.hash(), b => b.toString(16).padStart(2, '0')).join('') !== hash) return null;
    return data.successful ? 'confirmed' : 'failed';
  } catch { return null; }
}
