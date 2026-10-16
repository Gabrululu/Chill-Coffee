import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Account, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { TESTNET } from './config';
import { signReviewedTransaction, transactionHash } from './sign-reviewed';
const key = Keypair.random();
const build = (timeout = 180) => new TransactionBuilder(new Account(key.publicKey(), '1'), { fee: '100', networkPassphrase: TESTNET.passphrase }).addOperation(Operation.manageData({ name: 'test', value: 'review' })).setTimeout(timeout).build();
test('signs the exact reviewed envelope without refreshing SDK timebounds', async () => {
  const transaction = build(), reviewed = transactionHash(transaction);
  const original = transaction.toXdr();
  const signed = await signReviewedTransaction(transaction, reviewed, key.publicKey(), async (xdr, options) => {
    assert.equal(xdr, original); assert.equal(options.networkPassphrase, TESTNET.passphrase);
    const result = TransactionBuilder.fromXdr(xdr, TESTNET.passphrase); result.sign(key);
    return { signedTxXdr: result.toXdr(), signerAddress: key.publicKey() };
  });
  assert.equal(transactionHash(signed), reviewed); assert.equal(signed.timeBounds?.maxTime, transaction.timeBounds?.maxTime);
});
test('expired or changed previews never reach the signer; altered signatures are rejected', async () => {
  let called = false;
  const never = async () => { called = true; throw new Error('Unexpected signer'); };
  const transaction = build();
  for (const [built, hash] of [[transaction, '0'.repeat(64)], [build(0), transactionHash(build(0))]] as const) await assert.rejects(signReviewedTransaction(built, hash, key.publicKey(), never));
  assert.equal(called, false);
  const attacker = Keypair.random();
  await assert.rejects(signReviewedTransaction(transaction, transactionHash(transaction), key.publicKey(), async xdr => {
    const signed = TransactionBuilder.fromXdr(xdr, TESTNET.passphrase); signed.sign(attacker);
    return { signedTxXdr: signed.toXdr(), signerAddress: key.publicKey() };
  }));
});
