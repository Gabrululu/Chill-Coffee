import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Account, Keypair, TransactionBuilder, Operation, Asset } from '@stellar/stellar-sdk/base';
import { submitTransaction, trackTransaction, type TransactionRpc, type TransactionState } from './transaction';
import { TESTNET } from './config';
const key = Keypair.random();
const tx = new TransactionBuilder(new Account(key.publicKey(), '1'), { fee: '100', networkPassphrase: TESTNET.passphrase }).addOperation(Operation.payment({ destination: Keypair.random().publicKey(), asset: Asset.native(), amount: '0.1' })).setTimeout(180).build();
tx.sign(key);
const hash = Array.from(tx.hash(), byte => byte.toString(16).padStart(2, '0')).join('');
function server(sendStatus = 'PENDING', status = 'SUCCESS') {
  return { sendTransaction: async () => ({ status: sendStatus, hash }), getTransaction: async () => ({ status }), pollTransaction: async () => ({ status }) } as unknown as TransactionRpc;
}
test('saves the known hash before submission, then awaits a confirmed ledger result', async () => {
  const states: TransactionState[] = [];
  const rpc = server();
  rpc.sendTransaction = async () => { assert.equal(states[0].stage, 'submitting'); assert.equal(states[0].hash, hash); return { status: 'PENDING', hash } as Awaited<ReturnType<TransactionRpc['sendTransaction']>>; };
  const result = await submitTransaction(rpc, tx, state => states.push(state));
  assert.equal(result.stage, 'confirmed'); assert.deepEqual(states.map(s => s.stage), ['submitting', 'pending', 'confirmed']);
});
test('HTTP timeout while sending keeps the hash and reports uncertainty, not failure', async () => {
  const rpc = server(); rpc.sendTransaction = async () => { throw new Error('timeout'); };
  const result = await submitTransaction(rpc, tx, () => {});
  assert.equal(result.stage, 'unknown'); assert.equal(result.hash, hash);
});
test('pending timeout and unavailable RPC never become false confirmations', async () => {
  assert.equal((await trackTransaction(server('PENDING', 'NOT_FOUND'), hash, () => {})).stage, 'unknown');
  const rpc = server(); rpc.pollTransaction = async () => { throw new Error('offline'); };
  assert.equal((await trackTransaction(rpc, hash, () => {})).stage, 'unknown');
});
test('definitive network failure is reported, including already submitted transactions', async () => {
  assert.equal((await submitTransaction(server('ERROR'), tx, () => {})).stage, 'failed');
  assert.equal((await submitTransaction(server('PENDING', 'FAILED'), tx, () => {})).stage, 'failed');
});
test('already-known transactions are checked instead of resubmitted', async () => {
  let sends = 0;
  const rpc = server('DUPLICATE');
  const send = rpc.sendTransaction; rpc.sendTransaction = async signed => { sends++; return send(signed); };
  assert.equal((await submitTransaction(rpc, tx, () => {})).stage, 'confirmed'); assert.equal(sends, 1);
});
test('a busy network does not trigger automatic resubmission', async () => {
  assert.equal((await submitTransaction(server('TRY_AGAIN_LATER'), tx, () => {})).stage, 'unknown');
});
test('failure to persist the hash aborts before sending any transaction', async () => {
  let sends = 0;
  const rpc = server(); rpc.sendTransaction = async () => { sends++; throw new Error('Must not run'); };
  await assert.rejects(submitTransaction(rpc, tx, () => { throw new Error('Storage blocked'); }), /Storage/);
  assert.equal(sends, 0);
});

test('independent confirmed receipt resolves an unavailable RPC without any resubmission', async () => {
  const rpc = server(); let calls = 0;
  rpc.pollTransaction = async () => { calls++; throw new Error('RPC unavailable'); };
  rpc.sendTransaction = async () => { throw new Error('Recovery must never submit'); };
  const states: TransactionState[] = [];
  assert.equal((await trackTransaction(rpc, hash, state => states.push(state), async () => 'confirmed')).stage, 'confirmed');
  assert.equal(calls, 0); assert.equal(states[0].hash, hash);
});
test('secondary outage still permits RPC confirmation; both unavailable remain unknown', async () => {
  assert.equal((await trackTransaction(server(), hash, () => {}, async () => null)).stage, 'confirmed');
  const rpc = server(); rpc.pollTransaction = async () => { throw new Error('RPC unavailable'); };
  assert.equal((await trackTransaction(rpc, hash, () => {}, async () => {throw new Error('Horizon unavailable');})).stage, 'unknown');
});
