import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directoryBlock, registrationBlock, tipBlock } from './action-readiness';
const empty = { ready: true, loading: false, error: null, cafes: [] };
const approved = { ...empty, cafes: [{}] };
const wallet = { connected: true, hasTarget: true, account: { funded: true }, accountError: null, barista: 'barista', configError: null, selfTip: false, funding: false };
test('an empty confirmed directory explains the shared registration and tip blocker', () => {
  const reason = directoryBlock(empty);
  assert.match(reason!, /No cafés are approved/);
  assert.equal(registrationBlock({ ...empty, connected: true, eligibleCount: 0, targetId: '' }), reason);
  assert.equal(tipBlock({ ...empty, ...wallet, hasTarget: false }), reason);
  assert.doesNotMatch(reason!, /Loading|Checking/);
});
test('directory loading, failure and refresh with a retained café are distinct', () => {
  assert.match(directoryBlock({ ...empty, ready: false })!, /Loading/);
  assert.match(directoryBlock({ ...empty, error: 'unreachable' })!, /unavailable/);
  assert.equal(directoryBlock({ ...approved, loading: true, error: 'refresh failed' }), null);
});
test('registration permits connection and shared cafés but explains ownership and selection blockers', () => {
  assert.equal(registrationBlock({ ...empty, connected: false, eligibleCount: 0, targetId: '' }), null);
  assert.match(registrationBlock({ ...approved, connected: true, eligibleCount: 0, targetId: '' })!, /owner wallet/);
  assert.match(registrationBlock({ ...approved, connected: true, eligibleCount: 1, targetId: '' })!, /Choose/);
  assert.equal(registrationBlock({ ...approved, connected: true, eligibleCount: 1, targetId: 'shared-cafe' }), null);
});
test('tips explain balance, verification, funding and self-payment blockers before enabling', () => {
  assert.equal(tipBlock({ ...approved, ...wallet }), null);
  for (const [patch, message] of [
    [{ connected: false }, /Connect Freighter/],
    [{ hasTarget: false }, /Choose an approved café/],
    [{ account: null }, /Checking your Testnet balance/],
    [{ accountError: 'offline', account: null }, /could not be loaded/],
    [{ account: { funded: false } }, /Get Testnet XLM/],
    [{ funding: true }, /Waiting for Testnet funding/],
    [{ configError: 'hash mismatch', barista: null }, /could not be verified/],
    [{ barista: null }, /Checking the café recipient/],
    [{ selfTip: true }, /Connect another Testnet account/],
  ] as const) assert.match(tipBlock({ ...approved, ...wallet, ...patch })!, message);
});
