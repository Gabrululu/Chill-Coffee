import { Address, Asset, scValToNative, type Transaction } from '@stellar/stellar-sdk/base';
import { TESTNET } from './config';
import { WalletError } from './errors';
type Review = { account: string; contractId: string; method: string; destination?: string; amount?: bigint };
export function assertCafeAuthorization(transaction: Transaction, review: Review): void {
  const reject = (): never => { throw new WalletError('unexpected-authorization', 'This café requested an unexpected authorization or payment. Nothing was signed.'); };
  if (transaction.source !== review.account || transaction.operations.length !== 1) return reject();
  const operation = transaction.operations[0];
  if (operation.type !== 'invokeHostFunction') return reject();
  if (operation.source && operation.source !== review.account) return reject();
  if (operation.func.type !== 'hostFunctionTypeInvokeContract') return reject();
  const call = operation.func.value;
  if (Address.fromScAddress(call.contractAddress).toString() !== review.contractId || call.functionName.toString() !== review.method) return reject();
  const auth = operation.auth ?? [];
  if (auth.length !== 1 || auth[0].credentials.type !== 'sorobanCredentialsSourceAccount') return reject();
  const root = auth[0].rootInvocation;
  if (root.function.type !== 'sorobanAuthorizedFunctionTypeContractFn' || root.function.value.toXdr('base64') !== call.toXdr('base64')) return reject();
  const children = root.subInvocations;
  if (!review.destination || review.amount === undefined) { if (children.length) return reject(); return; }
  if (review.amount <= 0n || children.length !== 1) return reject();
  const transfer = children[0];
  if (transfer.function.type !== 'sorobanAuthorizedFunctionTypeContractFn' || transfer.subInvocations.length) return reject();
  const payment = transfer.function.value;
  if (Address.fromScAddress(payment.contractAddress).toString() !== Asset.native().contractId(TESTNET.passphrase) || payment.functionName.toString() !== 'transfer') return reject();
  const args = payment.args.map(scValToNative);
  if (args.length !== 3 || args[0] !== review.account || args[1] !== review.destination || args[2] !== review.amount) return reject();
}
