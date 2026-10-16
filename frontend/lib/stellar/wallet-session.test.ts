import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Account, Keypair, Operation, Asset, Transaction, TransactionBuilder, Networks } from '@stellar/stellar-sdk/base';
import { TESTNET } from './config';
import { createFreighterSigner, readWallet, requireWallet, walletSnapshot, type FreighterApi } from './wallet-session';

const key = Keypair.random();
const other = Keypair.random().publicKey();
function api(overrides: Partial<FreighterApi> = {}): FreighterApi {
  return {
    isConnected: async () => ({ isConnected: true }),
    getAddress: async () => ({ address: key.publicKey() }),
    requestAccess: async () => ({ address: key.publicKey() }),
    getNetworkDetails: async () => ({ network: 'TESTNET', networkPassphrase: TESTNET.passphrase, networkUrl: TESTNET.horizonUrl }),
    signTransaction: async xdr => {
      const transaction = TransactionBuilder.fromXdr(xdr, TESTNET.passphrase);
      transaction.sign(key);
      return { signedTxXdr: transaction.toXdr(), signerAddress: key.publicKey() };
    },
    ...overrides,
  };
}
function unsigned() {
  return new TransactionBuilder(new Account(key.publicKey(), '1'), { fee: '100', networkPassphrase: TESTNET.passphrase })
    .addOperation(Operation.payment({ destination: other, asset: Asset.native(), amount: '0.1' })).setTimeout(180).build().toXdr();
}
const options = { networkPassphrase: TESTNET.passphrase, address: key.publicKey() };

test('Testnet uses the official passphrase and ignores a spoofed network label', () => {
  assert.equal(TESTNET.passphrase, Networks.TESTNET);
  assert.equal(walletSnapshot(key.publicKey(), 'TESTNET', Networks.PUBLIC).status, 'wrong-network');
  assert.throws(() => requireWallet(walletSnapshot(key.publicKey(), 'TESTNET', Networks.PUBLIC)), /Switch/);
});
test('missing extension never requests permission', async () => {
  let calls = 0;
  await assert.rejects(readWallet(api({ isConnected: async () => ({ isConnected: false }), requestAccess: async () => { calls++; return { address: '' }; } }), true), /Freighter/);
  assert.equal(calls, 0);
});
test('refresh uses silent address lookup and does not open an access prompt', async () => {
  let prompts = 0;
  const snapshot = await readWallet(api({ requestAccess: async () => { prompts++; return { address: key.publicKey() }; } }));
  assert.equal(snapshot.status, 'connected'); assert.equal(prompts, 0);
});
test('permission rejection and locked wallets do not become connected', async () => {
  await assert.rejects(readWallet(api({ requestAccess: async () => ({ address: '', error: { code: -1, message: 'Access denied' } }) }), true), /denied/);
  assert.equal((await readWallet(api({ getAddress: async () => ({ address: '' }) }))).status, 'disconnected');
});
test('network errors and invalid public addresses cannot authorize signing', async () => {
  await assert.rejects(readWallet(api({ getAddress: async () => ({ address: 'DEMO-ADDRESS' }) })), /valid Stellar/);
  await assert.rejects(readWallet(api({ getNetworkDetails: async () => ({ network: '', networkPassphrase: '', networkUrl: '', error: { code: -1, message: 'Network unavailable' } }) })), /unavailable/);
});
test('signs the exact transaction with the requested address and Testnet passphrase', async () => {
  const xdr = unsigned();
  const signed = await createFreighterSigner(api(), key.publicKey())(xdr, options);
  const original = TransactionBuilder.fromXdr(xdr, TESTNET.passphrase);
  const result = TransactionBuilder.fromXdr(signed.signedTxXdr, TESTNET.passphrase);
  assert.deepEqual(original.hash(), result.hash()); assert.equal(result.signatures.length, 1);
});
test('wrong network or account prevents opening the signature prompt', async () => {
  let signatures = 0;
  const signTransaction = async () => { signatures++; return { signedTxXdr: '', signerAddress: '' }; };
  await assert.rejects(createFreighterSigner(api({ getNetworkDetails: async () => ({ network: 'PUBLIC', networkPassphrase: Networks.PUBLIC, networkUrl: '' }), signTransaction }), key.publicKey())(unsigned(), options), /Testnet/);
  await assert.rejects(createFreighterSigner(api({ getAddress: async () => ({ address: other }), signTransaction }), key.publicKey())(unsigned(), options), /changed/);
  assert.equal(signatures, 0);
});
test('network or account changed during approval is rejected before submission', async () => {
  let changed = false;
  const base = api();
  const signer = createFreighterSigner(api({
    getAddress: async () => ({ address: changed ? other : key.publicKey() }),
    signTransaction: async (xdr, opts) => { const result = await base.signTransaction(xdr, opts); changed = true; return result; },
  }), key.publicKey());
  await assert.rejects(signer(unsigned(), options), /changed/);
  changed = false;
  const networkSigner = createFreighterSigner(api({
    getNetworkDetails: async () => ({ network: changed ? 'PUBLIC' : 'TESTNET', networkPassphrase: changed ? Networks.PUBLIC : TESTNET.passphrase, networkUrl: '' }),
    signTransaction: async (xdr, opts) => { const result = await base.signTransaction(xdr, opts); changed = true; return result; },
  }), key.publicKey());
  await assert.rejects(networkSigner(unsigned(), options), /Testnet/);
});
test('user rejection and unexpected signer are not accepted as signed transactions', async () => {
  await assert.rejects(createFreighterSigner(api({ signTransaction: async () => ({ signedTxXdr: '', signerAddress: '', error: { code: -1, message: 'User rejected' } }) }), key.publicKey())(unsigned(), options), /rejected/);
  await assert.rejects(createFreighterSigner(api({ signTransaction: async () => ({ signedTxXdr: unsigned(), signerAddress: other }) }), key.publicKey())(unsigned(), options), /different signer/);
});
test('a modified transaction body or missing signature is rejected', async () => {
  const original = TransactionBuilder.fromXdr(unsigned(), TESTNET.passphrase);
  assert.ok(original instanceof Transaction);
  const modified = TransactionBuilder.cloneFrom(original, { fee: '999' }).build(); modified.sign(key);
  await assert.rejects(createFreighterSigner(api({ signTransaction: async () => ({ signedTxXdr: modified.toXdr(), signerAddress: key.publicKey() }) }), key.publicKey())(unsigned(), options), /does not match/);
  const xdr = unsigned();
  await assert.rejects(createFreighterSigner(api({ signTransaction: async () => ({ signedTxXdr: xdr, signerAddress: key.publicKey() }) }), key.publicKey())(xdr, options), /does not match/);
});
test('wrong signing options are blocked before contacting Freighter', async () => {
  await assert.rejects(createFreighterSigner(api(), key.publicKey())(unsigned(), { networkPassphrase: Networks.PUBLIC }), /context/);
});
test('a signature from another key cannot masquerade as the expected signer', async () => {
  const xdr = unsigned();
  const forged = TransactionBuilder.fromXdr(xdr, TESTNET.passphrase);
  forged.sign(Keypair.random());
  await assert.rejects(createFreighterSigner(api({ signTransaction: async () => ({ signedTxXdr: forged.toXdr(), signerAddress: key.publicKey() }) }), key.publicKey())(xdr, options), /expected account signature/);
});

test('unresponsive extension calls time out and a later reply cannot resume the operation', async () => {
  const { walletRequest } = await import('./wallet-session');
  let reply!: (value: string) => void;
  let continued = false;
  const pending = walletRequest(() => new Promise<string>(resolve => { reply = resolve; }), 5)
    .then(() => { continued = true; });
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /Freighter did not respond/);
    assert.match(error.message, /Nothing was sent/);
    return true;
  });
  reply('late response');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(continued, false);
  assert.equal(await walletRequest(async () => 'reconnected', 100), 'reconnected');
});
test('wallet request preserves extension errors rather than replacing them with a timeout', async () => {
  const { walletRequest } = await import('./wallet-session');
  const rejection = new Error('User declined');
  await assert.rejects(walletRequest(async () => { throw rejection; }, 100), error => error === rejection);
});
