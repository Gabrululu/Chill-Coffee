'use client';
import { useLanguage } from "@/components/language-provider";
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCafe } from './cafe-provider';
import { useBoardClock } from './use-cafe-board';
export function EventScreen({ children, page }: {
    children: ReactNode;
    page: 'live' | 'leaderboard';
}) { const { t } = useLanguage(); 
    const { online, ready, loading, error, lastUpdated, nextRefreshAt, refresh } = useCafe();
    const [presenting, setPresenting] = useState(false);
    const root = useRef<HTMLElement>(null), toggle = useRef<HTMLButtonElement>(null);
    const now = useBoardClock();
    const stale = (!!error || (!!lastUpdated && now - lastUpdated > 90000));
    const age = lastUpdated && now ? Math.max(0, Math.floor((now - lastUpdated) / 1000)) : null;
    useEffect(() => {
        const changed = () => { if (document.fullscreenElement !== root.current)
            setPresenting(false); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.fullscreenElement)
            setPresenting(false); };
        document.addEventListener('fullscreenchange', changed);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('fullscreenchange', changed); document.removeEventListener('keydown', escape); };
    }, []);
    useEffect(() => {
        if (!presenting)
            return;
        const previous = document.body.style.overflow;
        const button = toggle.current;
        document.body.style.overflow = 'hidden';
        document.body.classList.add('cafe-projecting');
        root.current?.focus();
        return () => { document.body.style.overflow = previous; document.body.classList.remove('cafe-projecting'); button?.focus(); };
    }, [presenting]);
    async function display() {
        if (presenting) {
            if (document.fullscreenElement === root.current)
                await document.exitFullscreen().catch(() => { });
            setPresenting(false);
        }
        else {
            setPresenting(true);
            // CSS projection mode also works where fullscreen is unavailable or denied.
            await root.current?.requestFullscreen?.().catch(() => { });
        }
    }
    return <section ref={root} tabIndex={-1} aria-label={page === 'live' ? 'Live café event board' : 'Café leaderboard'} className={`page-section event-screen ${presenting ? 'event-presenting' : ''}`}>
    <div className="event-toolbar"><span className="event-network"><span className="dot"/> {'STELLAR TESTNET'} · NO REAL FUNDS</span><div className="event-actions"><Link className="text-link" href={page === 'live' ? '/leaderboard' : '/live'}>{page === 'live' ? 'Leaderboard' : t("Live café")} ↗</Link><button ref={toggle} className="button" onClick={() => { void display(); }} aria-pressed={presenting}>{presenting ? 'Exit display mode ↙' : 'Enter display mode ↗'}</button></div></div>
    {(stale || !online) && <div className={`event-sync ${stale || !online ? 'event-stale' : ''}`}>
      <p role="status">{!online ? lastUpdated ? 'Offline · Keeping the last confirmed menu' : 'Offline · Waiting for café data' : !ready ? 'Opening the café…' : stale ? lastUpdated ? 'Catching up · Showing the last confirmed menu' : 'Waiting for the café to reconnect' : loading ? 'Checking for fresh creations…' : 'Café connected'}{age !== null && <small> · Checked {age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`} ago</small>}{error && nextRefreshAt && <small> · Retrying shortly</small>}</p>
      {<button className="text-link" disabled={loading || !online} onClick={() => { void refresh(); }}>{loading ? 'Refreshing…' : 'Refresh ↻'}</button>}
    </div>}
    {error && <p className="event-error" role="alert">{error}</p>}
    {children}
    <div className="event-invite"><span>There’s room for your next big idea.</span><Link className="text-link" href="/create">{t("Create your recipe ↗")}</Link><Link className="text-link" href="/menu">Explore & order ↗</Link></div>
  </section>;
}
