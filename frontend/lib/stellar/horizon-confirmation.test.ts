import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Account, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { readHorizonConfirmation } from './horizon-confirmation';
import { TESTNET } from './config';
import { transactionHash } from './sign-reviewed';
const key = Keypair.random();
const tx = new TransactionBuilder(new Account(key.publicKey(), '1'), { fee: '100', networkPassphrase: TESTNET.passphrase }).addOperation(Operation.manageData({name:'test',value:'receipt'})).setTimeout(180).build();
const hash = transactionHash(tx);
const receipt = {hash,successful:true,ledger:123,source_account:key.publicKey(),envelope_xdr:tx.toXdr()};
test('Horizon confirms only the exact ledger-included Testnet envelope', async () => {
  assert.equal(await readHorizonConfirmation(hash, async () => Response.json(receipt)), 'confirmed');
  assert.equal(await readHorizonConfirmation(hash, async () => Response.json({...receipt,successful:false})), 'failed');
});
test('missing, invalid, mismatched or unreachable receipts remain unknown', async () => {
  for (const patch of [{hash:'0'.repeat(64)}, {successful:'true'}, {ledger:0}, {envelope_xdr:'broken'}, {source_account:Keypair.random().publicKey()}]) assert.equal(await readHorizonConfirmation(hash, async () => Response.json({...receipt,...patch})), null);
  assert.equal(await readHorizonConfirmation('0'.repeat(64), async () => Response.json({...receipt,hash:'0'.repeat(64)})), null);
  assert.equal(await readHorizonConfirmation(hash, async () => new Response('',{status:404})), null);
  assert.equal(await readHorizonConfirmation(hash, async () => {throw new Error('offline');}), null);
});
