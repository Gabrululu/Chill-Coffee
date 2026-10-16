'use client';
import { useLanguage } from "@/components/language-provider";
import { useState } from 'react';
import { useCafe } from '@/components/cafe-provider';
import { categoryLabels } from '@/lib/cafe/recipe-kind';
import { RecipeArt } from '@/components/art';
import { EventScreen } from '@/components/event-screen';
import { useCafeBoard } from '@/components/use-cafe-board';
import { TREND_WINDOWS } from '@/lib/cafe/board';
import { short } from '@/lib/types';
export default function Live() { const { t } = useLanguage(); 
    const { items, ready, error } = useCafe();
    const [minutes, setMinutes] = useState<number>(30);
    const board = useCafeBoard(minutes);
    const highlight = (id: string) => board.highlighted.includes(id) ? ' board-highlight' : '';
    const empty = !ready ? 'Brewing the community menu…' : error && !items.length ? 'The menu will return when the café reconnects.' : 'The next favorite could be yours.';
    return <EventScreen page="live"><div className="live-title"><p className="eyebrow"><span className="dot"/> {t("LIVE FROM OUR LITTLE CORNER OF THE COSMOS")}</p><h1>Stellar Chill Café</h1><p>{t("Good coffee. Great company. Shared in real time.")}</p><div className="live-stats"><span><strong>{items.length}</strong> {t("creations")}</span><span><strong>{board.pending}</strong> {t("brewing now")}</span><span><strong>{board.served}</strong> {t("served with love")}</span><span><strong>{board.totalOrders}</strong> {t("menu orders")}</span></div></div>
    <div className="board-announcement" role="status" aria-live="polite">{board.message ? `✦ ${board.message}` : t("A little coffee. A little cosmos.")}</div>
    <div className="live-columns"><section className="panel"><p className="eyebrow">{t("THE CAFÉ’S CURRENT CRUSH")}</p><h2>🔥 Trending</h2><div className="trend-window" role="group" aria-label="Trending time window">{TREND_WINDOWS.map(value => <button key={value} aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{value} min</button>)}</div><p className="hint">{t("Confirmed orders")} {t("in the last")} {minutes} {t("minutes")}</p>{board.trending.slice(0, 3).map(item => <div className={`live-item${highlight(item.id)}`} key={item.id}><RecipeArt category={item.category} variant={item.art}/><div><h3>{item.name}</h3><span className="recipe-type">{t(categoryLabels[item.category])}</span><p>{board.recent.get(item.id)} recent orders · {item.cafe_name} · by {short(item.creator)}</p></div></div>)}{!board.trending.length && <p className="board-empty">{!ready ? 'Waiting for the first snapshot…' : 'A quiet moment. Order something lovely to start a trend.'}</p>}</section>
      <section className="panel"><p className="eyebrow">{t("JUST ADDED TO THE MENU")}</p><h2>{t("☕ Latest creations")}</h2>{board.latest.slice(0, 4).map(item => <div className={`live-row${highlight(item.id)}`} key={item.id}><span className="tiny-star">✦</span><div><h3>{item.name}</h3><span className="recipe-type">{t(categoryLabels[item.category])}</span><p>{item.cafe_name} · by <span title={item.creator}>{short(item.creator)}</span></p></div><span>{item.price_xlm} XLM</span></div>)}{!board.latest.length && <p className="board-empty">{empty}</p>}</section>
      <section className="panel"><p className="eyebrow">{t("THE COMMUNITY FAVORITES")}</p><h2>{t("🏆 Most ordered")}</h2><p className="hint">{t("All-time menu orders")}</p>{board.favorites.slice(0, 5).map((item, index) => <div className={`live-row${highlight(item.id)}`} key={item.id}><span className="position">{index + 1}</span><div><h3>{item.name}</h3><span className="recipe-type">{t(categoryLabels[item.category])}</span><p>{item.cafe_name} · {item.vibe}</p></div><strong>{item.orders_count}<small> {t("orders")}</small></strong></div>)}{!board.favorites.length && <p className="board-empty">{!ready ? empty : t("Your first order starts the leaderboard.")}</p>}</section></div>
    <section className="recent-cups panel" aria-label={t("Latest orders")}><div><p className="eyebrow">{t("FRESH FROM THE COUNTER")}</p><h2>{t("The latest orders")}</h2><p className="hint">{t("Ordered most recently · Current serving status")}</p></div><div className="recent-cup-list">{board.latestOrders.map(order => { const item = items.find(item => item.id === order.item_id); return <div key={order.id} className={`recent-cup${highlight(order.item_id)}`}><span className={`cup-status ${order.status.toLowerCase()}`}>{order.status === 'Pending' ? t("⏳ Preparing") : t("✓ Served")}</span><h3>{item?.name}</h3><p className="recipe-type">{item && t(categoryLabels[item.category])}</p><p title={order.buyer}>{order.cafe_name} · for {short(order.buyer)}</p></div>; })}{!board.latestOrders.length && <p className="board-empty">{t("The counter is ready for its first cup.")}</p>}</div></section>
    <p className="live-foot">{t("Testnet only · Checks about every 30 seconds while visible and online. Updates may take longer during a connection problem.")}</p>
  </EventScreen>;
}
