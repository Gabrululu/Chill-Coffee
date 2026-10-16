import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCafeSyncLoop, FULL_SYNC_INTERVAL, SYNC_INTERVAL } from './sync-loop';

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function harness(read: (force: boolean) => Promise<boolean> = async () => true) {
  let time = 0, active = true, id = 0;
  const calls: { at: number; force: boolean }[] = [];
  const timers = new Map<number, { at: number; fn: () => void }>();
  const loop = createCafeSyncLoop({
    read: async force => { calls.push({ at: time, force }); return read(force); },
    isActive: () => active, now: () => time, random: () => 0,
    setTimer: (fn, delay) => { const next = ++id; timers.set(next, { at: time + delay, fn }); return next as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: timer => { timers.delete(timer as unknown as number); },
  });
  return { loop, calls, timers, setActive: (value: boolean) => { active = value; loop.wake(); },
    advance: async (ms: number) => {
      const target = time + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        time = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
      }
      time = target; await flush();
    },
  };
}
test('sync reads immediately, probes every 30s and forces a five-minute reconciliation', async () => {
  const h = harness(); h.loop.start(); await flush();
  assert.deepEqual(h.calls, [{ at: 0, force: true }]);
  await h.advance(FULL_SYNC_INTERVAL);
  assert.equal(h.calls.length, 11); assert.equal(h.calls[1].at, SYNC_INTERVAL); assert.equal(h.calls[1].force, false);
  assert.deepEqual(h.calls.at(-1), { at: FULL_SYNC_INTERVAL, force: true });
  assert.equal(h.timers.size, 1); h.loop.stop(); assert.equal(h.timers.size, 0);
});
test('hidden/offline state pauses completely, then resumes without a burst', async () => {
  const h = harness(); h.setActive(false); h.loop.start(); await flush();
  await h.advance(300_000); assert.equal(h.calls.length, 0); assert.equal(h.timers.size, 0);
  h.setActive(true); await flush(); assert.equal(h.calls.length, 1);
  h.setActive(false); await h.advance(300_000); assert.equal(h.calls.length, 1);
  h.setActive(true); await flush(); assert.equal(h.calls.length, 2); assert.equal(h.timers.size, 1); h.loop.stop();
});
test('focus and tab-message bursts share a 15-second cooldown', async () => {
  const h = harness(); h.loop.start(); await flush();
  for (let i = 0; i < 20; i++) h.loop.wake();
  assert.equal(h.calls.length, 1); assert.equal(h.timers.size, 1);
  await h.advance(14_999); assert.equal(h.calls.length, 1);
  await h.advance(1); assert.equal(h.calls.length, 2); h.loop.stop();
});
test('failed reads back off to 60 then 120s; success restores the normal interval', async () => {
  let successes = false;
  const h = harness(async () => successes); h.loop.start(); await flush();
  h.loop.wake(); await h.advance(59_999); assert.equal(h.calls.length, 1);
  await h.advance(1); assert.equal(h.calls.length, 2);
  await h.advance(119_999); assert.equal(h.calls.length, 2);
  successes = true; await h.advance(1); assert.equal(h.calls.length, 3);
  await h.advance(30_000); assert.equal(h.calls.length, 4); h.loop.stop();
});
test('in-flight reads never overlap and stopping prevents further scheduling', async () => {
  let release!: (success: boolean) => void;
  const pending = new Promise<boolean>(resolve => { release = resolve; });
  const h = harness(async () => pending); h.loop.start(); await flush();
  await h.advance(600_000); for (let i = 0; i < 10; i++) h.loop.wake();
  assert.equal(h.calls.length, 1); assert.equal(h.timers.size, 0);
  h.loop.stop(); release(true); await flush(); assert.equal(h.timers.size, 0);
});
test('unexpected reader exceptions also back off instead of terminating the loop', async () => {
  const h = harness(async () => { throw new Error('offline'); }); h.loop.start(); await flush();
  await h.advance(60_000); assert.equal(h.calls.length, 2); assert.equal(h.timers.size, 1); h.loop.stop();
});
