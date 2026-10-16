import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatStroops, xlmToStroops } from './amount';
test('converts XLM exactly without floats and formats stroops', () => {
  assert.equal(xlmToStroops('0.1'), 1_000_000n);
  assert.equal(xlmToStroops('3.0000001'), 30_000_001n);
  assert.equal(xlmToStroops('0.0000001'), 1n);
  for (const input of ['0','1','0.1','3.1234567']) assert.equal(formatStroops(xlmToStroops(input)), input);
});
test('rejects negative, imprecise, exponential and overflowing amounts', () => {
  for (const input of ['-1','NaN','Infinity','1e2','0.00000001','', '1.', '9999999999999999999999999999999999999999999999']) assert.throws(() => xlmToStroops(input));
  assert.throws(() => formatStroops(-1n));
});
