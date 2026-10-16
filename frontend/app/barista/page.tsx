'use client';
import { useLanguage } from "@/components/language-provider";
import { useState } from 'react';
import { useCafe } from '@/components/cafe-provider';
import { categoryLabels } from '@/lib/cafe/recipe-kind';
import { short } from '@/lib/types';
import { canServe } from '@/lib/stellar/cafe-data';
import { errorMessage } from '@/lib/stellar/errors';
export default function Barista() { const { t } = useLanguage(); 
    const { orders, items, serve, wallet, connected, connect, setNotice, cafes, blocked, loading, ready, error } = useCafe();
    const [filter, setFilter] = useState('Pending');
    const [preparing, setPreparing] = useState<string | null>(null);
    const shown = orders.filter(o => o.status === filter).sort((a, b) => a.created_at - b.created_at);
    async function finish(id: string) {
        if (!connected) {
            connect();
            return;
        }
        if (preparing)
            return;
        setPreparing(id);
        try {
            await serve(id);
        }
        catch (failure) {
            setNotice(errorMessage(failure));
        }
        finally {
            setPreparing(null);
        }
    }
    return <section className="page-section"><div className="page-heading"><p className="eyebrow"><span className="dot"/> {t("THE HEART OF THE CAFÉ")}</p><h1>{t("Preparing orders")}<span> ☕</span></h1><p>{t("One cup at a time. One little moment of joy.")}</p></div><div className="queue-toolbar"><div className="filters">{['Pending', 'Served'].map(status => <button className={status === filter ? 'selected' : ''} key={status} onClick={() => setFilter(status)}>{status === 'Pending' ? t("On the counter") : t("Served with love")} · {orders.filter(o => o.status === status).length}</button>)}</div><span className="hint">{t("Only the recipe creator or event barista can serve")}</span></div><div className="queue-grid">{shown.map((order, index) => {
            const displayId = order.chain_id ?? order.id;
            const item = items.find(i => i.id === order.item_id);
            const allowed = (connected && canServe(order, wallet, cafes.find(c => c.contractId === order.cafe_id)?.barista ?? null));
            return <article className="queue-card" key={order.id}><div className="queue-top"><span>#{displayId}</span><span className="category">{filter === 'Pending' ? t("BREWING") : t("SERVED ✓")}</span></div><div className="queue-number">{String(index + 1).padStart(2, '0')}</div><h2>{item?.name || `Café creation #${order.item_id}`}</h2><p className="byline">{item && <span>{t(categoryLabels[item.category])} · </span>}{order.cafe_name}</p><p>for <strong>{short(order.buyer)}</strong></p><hr /><p className="byline">{t("CREATED BY")} <strong>{short(order.creator)}</strong></p>{order.status === 'Pending' ? !connected ? <button className="button primary full" onClick={connect}>{t("Connect Freighter")}</button> : allowed ? <button className="button primary full" disabled={blocked || !!preparing} onClick={() => { void finish(order.id); }}>{preparing === order.id ? t("Preparing…") : t("Served with love ✓")}</button> : <p className="hint">{t("Waiting for this creator or the event barista.")}</p> : <p className="success">{t("A little happiness, delivered. ✓")}</p>}</article>;
        })}</div>{!shown.length && ready && !loading && !error && <div className="empty">☕<h2>{filter === 'Pending' ? t("All caught up. Take a slow sip.") : t("The first happy customer is on their way.")}</h2><p>{t("Confirmed orders update here every 30 seconds while this tab is visible.")}</p></div>}</section>;
}
