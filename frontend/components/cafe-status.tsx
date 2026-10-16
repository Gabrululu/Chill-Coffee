'use client';
import { useLanguage } from './language-provider';
import { TestnetServices } from './testnet-services';
import { useCafe } from './cafe-provider';
export function CafeStatus() {
  const { t } = useLanguage();
  const {online, loading, error, lastUpdated, refresh, transaction, connect, ready, cafes} = useCafe();
  const unresolved = transaction.stage === 'unknown';
  const empty = ready && !error && cafes.length === 0;
  if (online && !error && !unresolved && !empty) return null;
  return <div className="cafe-sync" aria-live="polite">
    {(!online || error) && <>
      <span>{!online ? lastUpdated ? 'Offline · Showing the last confirmed café data.' : 'Offline · Waiting for café data.' : lastUpdated ? 'Showing last confirmed café data.' : 'The café could not load.'}</span>
      <button onClick={() => {void refresh();}} disabled={loading || !online}>{loading ? 'Refreshing…' : 'Refresh café ↻'}</button>
    </>}
    {empty && <><p role="status">{t('No cafés are approved in the event directory yet. The host must approve a café before recipes or tips can be registered.')}</p><button disabled={loading || !online} onClick={() => { void refresh(); }}>{t('Refresh café directory ↻')}</button></>}
    {unresolved && <button onClick={connect}>View unresolved transaction ↗</button>}
    {error && <><p className="error" role="alert">{error}</p><TestnetServices/></>}
  </div>;
}
