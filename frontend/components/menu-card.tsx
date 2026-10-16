'use client';
import { useLanguage } from "@/components/language-provider";
import { useEffect, useRef, useState } from 'react';
import { categoryLabels } from '@/lib/cafe/recipe-kind';
import { RecipeArt } from './art';
import { useCafe } from './cafe-provider';
import { short, type MenuItem } from '@/lib/types';
import { errorMessage } from '@/lib/stellar/errors';
export function MenuCard({ item, rank }: {
    item: MenuItem;
    rank?: number;
}) { const { t } = useLanguage(); 
    const [open, setOpen] = useState(false);
    return <><article className={`menu-card art-${item.art % 4}`}><div className="card-art"><span className="category">{t(categoryLabels[item.category])}</span>{rank && <span className="rank">#{rank} {t("MOST LOVED")}</span>}<RecipeArt category={item.category} variant={item.art}/></div><div className="card-body"><div className="card-title"><h3>{item.name}</h3><span>{item.price_xlm}<small> XLM</small></span></div><p className="byline">{item.cafe_name && <span>{item.cafe_name} · </span>}by {short(item.creator)}</p><p className="vibe">{item.vibe}</p><p className="recipe-description">{item.description}</p><div className="ingredients">{item.ingredients.slice(0, 3).map(i => <span key={i}>{i}</span>)}</div><div className="card-bottom"><span>♡ {item.orders_count} {t("orders")}</span><button onClick={() => setOpen(true)}>{t("Order a little joy")} <span>↗</span></button></div></div></article>{open && <OrderModal item={item} close={() => setOpen(false)}/>}</>;
}
function OrderModal({ item, close }: {
    item: MenuItem;
    close: () => void;
}) { const { t } = useLanguage(); 
    const { wallet, connected, connect, order, blocked } = useCafe();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { ref.current?.showModal(); }, []);
    const selfOrder = wallet === item.creator;
    async function submit() {
        if (busy)
            return;
        setBusy(true);
        setError('');
        try {
            await order(item);
            close();
        }
        catch (failure) {
            setError(errorMessage(failure));
        }
        finally {
            setBusy(false);
        }
    }
    return <dialog ref={ref} onCancel={close} aria-labelledby="order-title"><button className="close" aria-label={t("Close order")} onClick={close} disabled={busy}>×</button><RecipeArt category={item.category} variant={item.art}/><p className="eyebrow">{t("YOUR NEXT COZY MOMENT")}</p><h2 id="order-title">{`${t("Order")} ${item.name}?`}</h2><p className="recipe-type">{t(categoryLabels[item.category])}</p><p>{item.description}</p><p>{t("Made by the community. Enjoyed by you.")}</p><div className="receipt">{item.cafe_name && <><span>Café</span><strong>{item.cafe_name}</strong></>}<span>{t("Creator")}</span><code>{item.creator}</code><span>{t("Price")}</span><strong>{item.price_xlm} XLM</strong></div><p className="hint">{t("Menu price shown above. Review the simulated charge (including any café discount) and fee before signing in Freighter.")}</p>{selfOrder && <p className="hint">{t("This is your creation. Choose another participant’s recipe to order.")}</p>}{error && <p role="alert" className="error">{error}</p>}<div className="actions"><button className="button" onClick={close} disabled={busy}>{t("Cancel")}</button>{blocked ? <button className="button primary" onClick={() => { close(); connect(); }}>{t("View current transaction")}</button> : <button className="button primary" disabled={busy || selfOrder} onClick={connected ? submit : () => { close(); connect(); }}>{busy ? t("Preparing your order…") : !connected ? (t("Connect Freighter")) : t("Review order with Freighter →")}</button>}</div></dialog>;
}
