import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contract, xdr } from '@stellar/stellar-sdk';
import { Client } from './generated/client';
import { TESTNET, CAFE_CONTRACT_ID } from './config';
import { assertCompatibleSpec } from './compatibility';
const base = new Client({ contractId: CAFE_CONTRACT_ID, rpcUrl: TESTNET.rpcUrl, networkPassphrase: TESTNET.passphrase }).spec;
test('common ABI accepts unchanged functions and ignores documentation changes', () => {
  assert.doesNotThrow(() => assertCompatibleSpec(base));
  const changed = base.entries.map(entry => entry.type === 'scSpecEntryFunctionV0' ? xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({ ...entry.value, doc: 'Workshop comments are free to change.' })) : entry);
  assert.doesNotThrow(() => assertCompatibleSpec(new contract.Spec(changed)));
});
test('rejects missing methods, changed argument types and altered order structures', () => {
  const missing = base.entries.filter(entry => entry.type !== 'scSpecEntryFunctionV0' || entry.value.name.toString() !== 'order_item');
  assert.throws(() => assertCompatibleSpec(new contract.Spec(missing)), /fn:order_item/);
  const wrongArgs = base.entries.map(entry => entry.type === 'scSpecEntryFunctionV0' && entry.value.name.toString() === 'get_item' ? xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({ ...entry.value, inputs: [new xdr.ScSpecFunctionInputV0({ doc: '', name: 'id', type: xdr.ScSpecTypeDef.scSpecTypeString() })] })) : entry);
  assert.throws(() => assertCompatibleSpec(new contract.Spec(wrongArgs)), /fn:get_item/);
  const wrongOrder = base.entries.map(entry => entry.type === 'scSpecEntryUdtStructV0' && entry.value.name.toString() === 'Order' ? xdr.ScSpecEntry.scSpecEntryUdtStructV0(new xdr.ScSpecUdtStructV0({ ...entry.value, fields: entry.value.fields.filter(f => f.name.toString() !== 'amount') })) : entry);
  assert.throws(() => assertCompatibleSpec(new contract.Spec(wrongOrder)), /type:Order/);
});
