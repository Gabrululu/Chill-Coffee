export function xlmToStroops(value: string): bigint {
  if (!/^\d+(\.\d{1,7})?$/.test(value)) throw new Error('Use a non-negative decimal amount with at most 7 places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0'));
  if (amount > (1n << 127n) - 1n) throw new Error('Amount exceeds the contract integer limit.');
  return amount;
}
export function formatStroops(value: string | bigint): string {
  const amount = BigInt(value);
  if (amount < 0n) throw new Error('Amount must not be negative.');
  const fraction = (amount % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return `${amount / 10_000_000n}${fraction ? `.${fraction}` : ''}`;
}
