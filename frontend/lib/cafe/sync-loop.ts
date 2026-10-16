export const SYNC_INTERVAL = 30_000;
export const FULL_SYNC_INTERVAL = 5 * 60_000;
export const WAKE_INTERVAL = 15_000;
export const syncDelay = (failures: number) => Math.min(120_000, SYNC_INTERVAL * 2 ** Math.min(failures, 2));

type Options = {
  read: (force: boolean) => Promise<boolean>;
  isActive: () => boolean;
  scheduled?: (at: number | null) => void;
  now?: () => number;
  random?: () => number;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};
// One timer scheduled after each completed read. Focus, online and tab messages
// all pass through the same cooldown; they cannot create competing polling loops.
export function createCafeSyncLoop(options: Options) {
  const now = options.now ?? Date.now, random = options.random ?? Math.random;
  const setTimer = options.setTimer ?? setTimeout, clearTimer = options.clearTimer ?? clearTimeout;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = true, reading = false, failures = 0, lastAttempt = -Infinity, lastFull = -Infinity;
  const clear = () => { if (timer !== undefined) clearTimer(timer); timer = undefined; options.scheduled?.(null); };
  const schedule = (delay: number) => {
    clear();
    if (stopped || !options.isActive()) return;
    options.scheduled?.(now() + delay);
    timer = setTimer(() => { timer = undefined; void run(); }, delay);
  };
  async function run() {
    if (stopped || reading || !options.isActive()) return;
    const remaining = (failures ? syncDelay(failures) : WAKE_INTERVAL) - (now() - lastAttempt);
    if (remaining > 0) { schedule(remaining); return; }
    clear(); reading = true; lastAttempt = now();
    const force = now() - lastFull >= FULL_SYNC_INTERVAL;
    let success = false;
    try { success = await options.read(force); } catch { /* Retry with backoff; never spin. */ }
    if (success) { failures = 0; if (force) lastFull = now(); } else failures++;
    reading = false;
    schedule(syncDelay(failures) + Math.floor(random() * 3_000));
  }
  return {
    start: () => { stopped = false; void run(); },
    wake: () => { clear(); void run(); },
    stop: () => { stopped = true; clear(); },
  };
}
