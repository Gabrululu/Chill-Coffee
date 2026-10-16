import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Account, Address, Asset, Keypair, Operation, TransactionBuilder, nativeToScVal, xdr } from '@stellar/stellar-sdk/base';
import { assertCafeAuthorization } from './authorization';
import { TESTNET, CAFE_CONTRACT_ID } from './config';
const account = Keypair.random().publicKey(), creator = Keypair.random().publicKey();
const call = (id: string, method: string, args: xdr.ScVal[]) => new xdr.InvokeContractArgs({ contractAddress: new Address(id).toScAddress(), functionName: method, args });
const invoke = (fn: xdr.InvokeContractArgs, children: xdr.SorobanAuthorizedInvocation[] = []) => new xdr.SorobanAuthorizedInvocation({ function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(fn), subInvocations: children });
function transaction({ amount = 30_000_000n, recipient = creator, token = Asset.native().contractId(TESTNET.passphrase), method = 'order_item', noAuth = false, extra = false, children = true, wrongRoot = false } = {}) {
  const rootCall = call(CAFE_CONTRACT_ID, method, [nativeToScVal(account, { type: 'address' })]);
  const transfer = invoke(call(token, 'transfer', [nativeToScVal(account, { type: 'address' }), nativeToScVal(recipient, { type: 'address' }), nativeToScVal(amount, { type: 'i128' })]));
  const auth = new xdr.SorobanAuthorizationEntry({ credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(), rootInvocation: invoke(wrongRoot ? call(CAFE_CONTRACT_ID, 'other', []) : rootCall, children ? [transfer] : []) });
  const builder = new TransactionBuilder(new Account(account, '1'), { fee: '100', networkPassphrase: TESTNET.passphrase }).setTimeout(180);
  builder.addOperation(Operation.invokeHostFunction({ func: xdr.HostFunction.hostFunctionTypeInvokeContract(rootCall), auth: noAuth ? [] : extra ? [auth, auth] : [auth] }));
  return builder.build();
}
const review = { account, contractId: CAFE_CONTRACT_ID, method: 'order_item', destination: creator, amount: 30_000_000n };
test('accepts only the exact reviewed native XLM transfer in the signed authorization tree', () => {
  assert.doesNotThrow(() => assertCafeAuthorization(transaction(), review));
  assert.doesNotThrow(() => assertCafeAuthorization(transaction({ amount: 27_000_000n }), { ...review, amount: 27_000_000n }));
});
test('rejects excessive charges, unexpected recipients/assets, missing or extra auth and changed roots', () => {
  for (const tx of [transaction({ amount: 31_000_000n }), transaction({ recipient: account }), transaction({ token: CAFE_CONTRACT_ID }), transaction({ noAuth: true }), transaction({ extra: true }), transaction({ wrongRoot: true }), transaction({ children: false })]) assert.throws(() => assertCafeAuthorization(tx, review), /unexpected authorization/);
  assert.throws(() => assertCafeAuthorization(transaction(), { ...review, amount: 27_000_000n }));
});
test('registration and service never authorize nested payments', () => {
  assert.doesNotThrow(() => assertCafeAuthorization(transaction({ method: 'register_item', children: false }), { account, contractId: CAFE_CONTRACT_ID, method: 'register_item' }));
  assert.throws(() => assertCafeAuthorization(transaction({ method: 'register_item' }), { account, contractId: CAFE_CONTRACT_ID, method: 'register_item' }));
  assert.throws(() => assertCafeAuthorization(transaction(), { ...review, account: creator }));
});
