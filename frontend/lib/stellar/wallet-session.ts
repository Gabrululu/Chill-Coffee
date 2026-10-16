import { Keypair, StrKey, Transaction, TransactionBuilder } from '@stellar/stellar-sdk/base';
import type * as Freighter from '@stellar/freighter-api';
import { TESTNET } from './config';
import { WalletError } from './errors';

export type FreighterApi = Pick<typeof Freighter, 'isConnected' | 'getAddress' | 'requestAccess' | 'getNetworkDetails' | 'signTransaction'>;
import { DISCONNECTED, type WalletSnapshot } from './wallet-state';
export { DISCONNECTED, type WalletSnapshot, type WalletStatus } from './wallet-state';

export function walletSnapshot(address: string, network: string, passphrase: string): WalletSnapshot {
  if (!StrKey.isValidEd25519PublicKey(address)) throw new WalletError('invalid-address', 'Freighter did not return a valid Stellar account.');
  return {
    address, network,
    status: passphrase === TESTNET.passphrase ? 'connected' : 'wrong-network',
    error: passphrase === TESTNET.passphrase ? null : 'Choose Testnet in Freighter, then refresh your connection.',
  };
}
// Extension requests can remain unresolved when a popup or content script stops responding.
// Late replies are ignored; a timed-out signature is never submitted.
export async function walletRequest<T>(request: () => Promise<T>, timeout = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new WalletError('wallet-timeout', 'Freighter did not respond. Open and unlock the extension, close any pending requests, then try again. Nothing was sent.')), timeout);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function readWallet(api: FreighterApi, requestAccess = false): Promise<WalletSnapshot> {
  const installed = await walletRequest(() => api.isConnected());
  if (installed.error || !installed.isConnected) throw new WalletError('missing-extension', 'Install or unlock Freighter, then connect again.');
  const result = await walletRequest(() => requestAccess ? api.requestAccess() : api.getAddress(), requestAccess ? 60_000 : 10_000);
  if (result.error) throw new WalletError('wallet-access', result.error.message);
  if (!result.address) return DISCONNECTED;
  const details = await walletRequest(() => api.getNetworkDetails());
  if (details.error) throw new WalletError('wallet-network', details.error.message);
  return walletSnapshot(result.address, details.network, details.networkPassphrase);
}
export function requireWallet(snapshot: WalletSnapshot, expectedAddress?: string): string {
  if (snapshot.status === 'wrong-network') throw new WalletError('wrong-network', 'Switch Freighter to Stellar Testnet before signing.');
  if (snapshot.status !== 'connected' || !snapshot.address) throw new WalletError('disconnected', 'Connect and unlock Freighter first.');
  if (expectedAddress && snapshot.address !== expectedAddress) throw new WalletError('account-changed', 'The active wallet account changed. Nothing was sent; refresh and review again.');
  return snapshot.address;
}

// Freighter holds the key. We accept only a signature over the exact transaction
// the app prepared, from the account and Testnet network the user reviewed.
export function createFreighterSigner(api: FreighterApi, expectedAddress: string) {
  return async (xdr: string, opts?: { networkPassphrase?: string; address?: string }) => {
    if (opts?.networkPassphrase !== TESTNET.passphrase || (opts.address && opts.address !== expectedAddress)) {
      throw new WalletError('wrong-signing-context', 'Signing context does not match the reviewed Testnet account.');
    }
    requireWallet(await readWallet(api), expectedAddress);
    const result = await walletRequest(() => api.signTransaction(xdr, { networkPassphrase: TESTNET.passphrase, address: expectedAddress }), 120_000);
    if (result.error) throw new WalletError('signature-rejected', result.error.message);
    if (!result.signedTxXdr || result.signerAddress !== expectedAddress) throw new WalletError('wrong-signer', 'Freighter returned a different signer. Nothing was sent.');
    requireWallet(await readWallet(api), expectedAddress);
    const unsigned = TransactionBuilder.fromXdr(xdr, TESTNET.passphrase);
    const signed = TransactionBuilder.fromXdr(result.signedTxXdr, TESTNET.passphrase);
    if (!(unsigned instanceof Transaction) || !(signed instanceof Transaction) || unsigned.hash().some((byte, i) => signed.hash()[i] !== byte) || signed.signatures.length === 0) {
      throw new WalletError('modified-transaction', 'The signed transaction does not match what you reviewed. Nothing was sent.');
    }
    const publicKey = Keypair.fromPublicKey(expectedAddress);
    if (!signed.signatures.some(signature => publicKey.verify(signed.hash(), signature.signature))) {
      throw new WalletError('invalid-signature', 'Freighter did not provide the expected account signature. Nothing was sent.');
    }
    return { signedTxXdr: result.signedTxXdr, signerAddress: result.signerAddress };
  };
}
