'use client';
import { useState } from 'react';
import type { TestnetStatus } from '@/lib/stellar/service-status';
export function TestnetServices() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<TestnetStatus | null>(null);
  const [error, setError] = useState('');
  async function check() {
    if (busy) return;
    setBusy(true); setError(''); setStatus(null);
    try {
      const response = await fetch('/api/stellar/health', { cache: 'no-store', signal: AbortSignal.timeout(16_000) });
      if (!response.ok) throw new Error();
      setStatus(await response.json());
    } catch { setError('Could not run the service check. Check your connection to this café website.'); }
    finally { setBusy(false); }
  }
  return <div><button className="text-link" disabled={busy} onClick={() => { void check(); }}>{busy ? 'Checking Testnet services…' : 'Check Testnet services ↗'}</button>
    <div role="status">{status && <><p className={status.rpc.ok ? 'hint' : 'error'}>{status.rpc.detail}</p><p className={status.horizon.ok ? 'hint' : 'error'}>{status.horizon.detail}</p><p className="hint">This checks the café server’s connection. If both services respond but your browser cannot load the café, check your browser network, VPN or extensions.</p></>}{error && <p className="error">{error}</p>}</div>
  </div>;
}
