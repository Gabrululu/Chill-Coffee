'use client';
import { useLanguage } from "@/components/language-provider";
import Link from 'next/link';
import { useCafe } from '@/components/cafe-provider';
import { categoryLabels } from '@/lib/cafe/recipe-kind';
import { RecipeArt } from '@/components/art';
import { EventScreen } from '@/components/event-screen';
import { useCafeBoard } from '@/components/use-cafe-board';
import { short } from '@/lib/types';
export default function Leaderboard() { const { t } = useLanguage(); 
    const { ready, error } = useCafe();
    const board = useCafeBoard();
    const newest = board.latest[0];
    return <EventScreen page="leaderboard"><div className="page-heading"><p className="eyebrow">{t("A ROUND OF APPLAUSE, AND ESPRESSO")}</p><h1>{t("The most loved menu")}</h1><p>{t("Little creations making a big impression.")}</p><p className="hint">{t("All-time confirmed menu orders. Ties show the newest creation first.")}</p></div>
    <div className="board-announcement" role="status" aria-live="polite">{board.message ? `✦ ${board.message}` : t("Every cup is a little vote of love.")}</div>
    {!!board.favorites.length && <div className="podium">{board.favorites.slice(0, 3).map((item, index) => <div className={`podium-card place-${index}${board.highlighted.includes(item.id) ? ' board-highlight' : ''}`} key={item.id}><span className="eyebrow">{[t("✦ THE CAFÉ FAVORITE"), t("02 / RUNNER-UP"), t("03 / CROWD PLEASER")][index]}</span><RecipeArt category={item.category} variant={item.art}/><span className="recipe-type">{t(categoryLabels[item.category])}</span><h2>{item.name}</h2><p title={item.creator}>{item.cafe_name} · by {short(item.creator)}</p><strong>{item.orders_count} <small>{t("orders")}</small></strong></div>)}</div>}
    {!board.favorites.length && <div className="panel board-empty">{!ready ? 'Preparing the community leaderboard…' : error && !board.ranked.length ? 'The rankings will return when the café reconnects.' : 'No favorites just yet. The first order starts something lovely.'}</div>}
    {!!board.ranked.length && <div className="leader-table panel"><table><caption className="sr-only">Most ordered café creations, including those waiting for their first order</caption><thead><tr><th scope="col">{t("RANK")}</th><th scope="col">{t("CREATION")}</th><th scope="col">{t("CREATOR")}</th><th scope="col">{t("ORDERS")}</th></tr></thead><tbody>{board.ranked.map((item, index) => <tr key={item.id} className={board.highlighted.includes(item.id) ? 'board-highlight' : ''}><td className="position">{String(index + 1).padStart(2, '0')}</td><th scope="row"><Link href="/menu">{item.name}<small>{t(categoryLabels[item.category])} · {item.cafe_name} · {item.vibe}</small></Link></th><td className="byline"><span title={item.creator}>{short(item.creator)}</span></td><td><strong>{item.orders_count}</strong></td></tr>)}</tbody></table></div>}
    <div className="award-grid"><div className="panel"><p className="eyebrow">{t("✧ TOP CREATOR")}</p><h2 title={board.topCreator?.address}>{board.topCreator ? short(board.topCreator.address) : t("Your name here")}</h2><p>{board.topCreator ? `${board.topCreator.count} orders across ${board.topCreator.creations} creations` : t("The first order could start your story.")}</p></div><div className="panel"><p className="eyebrow">{t("☕ NEWEST CREATION")}</p><h2>{newest?.name ?? t("A little inspiration is brewing")}</h2>{newest && <span className="recipe-type">{t(categoryLabels[newest.category])}</span>}<p>{newest ? `Created by ${short(newest.creator)}` : t("There’s always room for a new favorite.")}</p></div></div>
  </EventScreen>;
}
