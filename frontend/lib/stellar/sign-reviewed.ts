import { Keypair, Transaction, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { TESTNET } from './config';
import { WalletError } from './errors';
type Signer = (xdr: string, options: { networkPassphrase: string; address: string }) => Promise<{ signedTxXdr: string; signerAddress?: string }>;
export const transactionHash = (transaction: Transaction) => Array.from(transaction.hash(), b => b.toString(16).padStart(2, '0')).join('');

// AssembledTransaction.sign() refreshes timebounds in SDK 17. Sign the already
// reviewed envelope directly: changing any field requires a new user review.
export async function signReviewedTransaction(built: Transaction | undefined, reviewedHash: string | undefined, account: string, signer: Signer): Promise<Transaction> {
  if (!built || !reviewedHash || built.source !== account || built.networkPassphrase !== TESTNET.passphrase || transactionHash(built) !== reviewedHash) throw new WalletError('changed-review', 'The transaction changed after review. Prepare it again.');
  const expires = Number(built.timeBounds?.maxTime ?? '0');
  if (!expires || expires <= Date.now() / 1000) throw new WalletError('expired-review', 'This transaction preview expired. Cancel and prepare it again.');
  const result = await signer(built.toXdr(), { networkPassphrase: TESTNET.passphrase, address: account });
  const signed = TransactionBuilder.fromXdr(result.signedTxXdr, TESTNET.passphrase);
  if (!(signed instanceof Transaction) || result.signerAddress !== account || transactionHash(signed) !== reviewedHash || !signed.signatures.some(signature => Keypair.fromPublicKey(account).verify(signed.hash(), signature.signature))) throw new WalletError('invalid-signature', 'The signature does not match the reviewed transaction and account. Nothing was sent.');
  return signed;
}
