import { StrKey } from '@stellar/stellar-sdk/base';
import { TESTNET } from './config';
import { WalletError } from './errors';
import { serviceFailure, type Service } from './service-status';
async function request(service: Service, url: string, timeout: number) {
  try { return await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeout) }); }
  catch { throw serviceFailure(service); }
}
export type AccountInfo = { funded: boolean; balance: string };
export async function getAccountInfo(address: string): Promise<AccountInfo> {
  if (!StrKey.isValidEd25519PublicKey(address)) throw new WalletError('invalid-address', 'Invalid Testnet account.');
  const response = await request('horizon', `${TESTNET.horizonUrl}/accounts/${address}`, 15_000);
  if (response.status === 404) return { funded: false, balance: '0' };
  if (!response.ok) throw serviceFailure('horizon', response.status);
  const data = await response.json();
  const native = data.balances?.find((balance: { asset_type: string }) => balance.asset_type === 'native');
  if (!native || typeof native.balance !== 'string' || !/^\d+(\.\d{1,7})?$/.test(native.balance)) throw new WalletError('balance', 'Horizon returned an invalid Testnet balance.');
  return { funded: true, balance: native.balance };
}
export async function fundTestnetAccount(address: string): Promise<AccountInfo> {
  const before = await getAccountInfo(address);
  if (before.funded) throw new WalletError('already-funded', 'This account is already funded. Friendbot is only offered for new Testnet accounts.');
  const response = await request('friendbot', `${TESTNET.friendbotUrl}/?addr=${encodeURIComponent(address)}`, 30_000);
  if (!response.ok) throw serviceFailure('friendbot', response.status);
  const after = await getAccountInfo(address);
  if (!after.funded) throw new WalletError('funding-unconfirmed', 'Funding has not appeared yet. Refresh the balance before retrying Friendbot.');
  return after;
}
