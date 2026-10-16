export class WalletError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'WalletError';
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof WalletError) return error.message;
  const raw = error instanceof Error ? error.message : String(error);
  if (/reject|declin|denied|cancel/i.test(raw)) return 'Signature cancelled. Nothing was sent.';
  if (/account.*not found|account.*does not exist|could not find.*account|fakeaccount|account entry is missing/i.test(raw)) return 'This Testnet account needs funding. Use Get Testnet XLM first.';
  if (/insufficient|underfunded|balance.*low/i.test(raw)) return 'Not enough Testnet XLM for the transfer and network fees.';
  if (/tx_bad_seq|bad sequence/i.test(raw)) return 'Your account changed while preparing. Refresh the wallet before retrying.';
  if (/DuplicateRequest/.test(raw)) return 'This request was already processed. Check its previous transaction before sending another.';
  if (/PriceChanged/.test(raw)) return 'The item price changed. Refresh the menu before ordering.';
  if (/AlreadyServed/.test(raw)) return 'This order is already served. Refresh the queue.';
  if (/Unauthorized/.test(raw)) return 'Only the recipe creator or event barista can serve this order.';
  if (/SelfPayment/.test(raw)) return 'Choose another participant’s recipe or barista account. Self-payments are not allowed.';
  if (/archiv|restore|expired state/i.test(raw)) return 'The contract state needs restoration. Restore it with Stellar CLI before retrying.';
  const status = error && typeof error === 'object' && 'response' in error ? (error.response as { status?: unknown } | undefined)?.status : undefined;
  if (typeof status === 'number' && status >= 500) return `The Testnet service returned HTTP ${status}. Your Freighter connection can still be valid. Wait and refresh; check any unresolved transaction before retrying.`;
  if (/timeout|timed out|fetch|network|ECONN|HTTP|service/i.test(raw)) return 'A Testnet data request failed. This is separate from your Freighter connection. Use Check Testnet services and refresh; check any unresolved transaction before retrying.';
  return 'The transaction could not be prepared or completed. Check the wallet and your Testnet balance.';
}
