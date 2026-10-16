import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk/base';
import { readWallet, createFreighterSigner, type FreighterApi } from '../frontend/lib/stellar/wallet-session';
import { readCafeConfig, prepareTip, server, getCafeClient } from '../frontend/lib/stellar/cafe-contract';
import { fundTestnetAccount, getAccountInfo } from '../frontend/lib/stellar/account';
import { submitTransaction, type TransactionState } from '../frontend/lib/stellar/transaction';
import { CAFE_CONTRACT_ID, TESTNET, TIP_STROOPS } from '../frontend/lib/stellar/config';
import { xlmToStroops } from '../frontend/lib/stellar/amount';

async function main() {
  console.log('☕ Phase 3 SDK rehearsal — TESTNET ONLY.');
  console.log('Uses an in-memory test signer behind the Freighter adapter interface. This does NOT test the browser extension popup.');
  const key = Keypair.random(); // Never logged or persisted.
  const publicKey = key.publicKey();
  await fundTestnetAccount(publicKey);
  const config = await readCafeConfig();
  const before = await getAccountInfo(config.barista);
  const client = await getCafeClient(publicKey);
  const totalBefore = (await client.get_tip_total()).result.unwrap();
  const api: FreighterApi = {
    isConnected: async () => ({ isConnected: true }),
    getAddress: async () => ({ address: publicKey }),
    requestAccess: async () => ({ address: publicKey }),
    getNetworkDetails: async () => ({ network: 'TESTNET', networkPassphrase: TESTNET.passphrase, networkUrl: TESTNET.horizonUrl }),
    signTransaction: async (xdr, opts) => {
      assert.equal(opts?.networkPassphrase, TESTNET.passphrase);
      assert.equal(opts.address, publicKey);
      const tx = TransactionBuilder.fromXdr(xdr, TESTNET.passphrase);
      tx.sign(key);
      return { signedTxXdr: tx.toXdr(), signerAddress: publicKey };
    },
  };
  assert.equal((await readWallet(api, true)).status, 'connected');
  const requestId = randomBytes(32).toString('hex');
  const prepared = await prepareTip(publicKey, requestId, config.barista);
  assert.equal(prepared.transaction.isReadCall, false);
  await prepared.transaction.sign({ signTransaction: createFreighterSigner(api, publicKey) });
  assert.ok(prepared.transaction.signed);
  const states: TransactionState[] = [];
  const result = await submitTransaction(server, prepared.transaction.signed, state => { states.push(state); console.log(`${state.stage}${state.hash ? ` · ${state.hash}` : ''}`); });
  assert.equal(result.stage, 'confirmed', 'Check the printed hash before running another rehearsal if confirmation timed out.');
  const after = await getAccountInfo(config.barista);
  assert.equal(xlmToStroops(after.balance) - xlmToStroops(before.balance), TIP_STROOPS);
  const totalAfter = (await client.get_tip_total()).result.unwrap();
  assert.equal(totalAfter - totalBefore, TIP_STROOPS);
  const receipt = { network: 'testnet', contract_id: CAFE_CONTRACT_ID, account: publicKey, barista: config.barista, amount_stroops: TIP_STROOPS.toString(), fee_stroops: prepared.fee, request_id: requestId, transaction_hash: result.hash, states: states.map(s => s.stage), signer: 'ephemeral in-memory keypair through the Freighter adapter; not a browser extension test', confirmed_at: new Date().toISOString() };
  mkdirSync('deployments', { recursive: true });
  writeFileSync('deployments/wallet-testnet.local.json', JSON.stringify(receipt, null, 2) + '\n');
  console.log('✓ SDK simulation, signature, submission, confirmation and exact native XLM transfer verified.');
  console.log(JSON.stringify(receipt, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
