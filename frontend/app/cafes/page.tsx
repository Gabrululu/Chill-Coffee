'use client';
import { useLanguage } from "@/components/language-provider";
import Link from 'next/link';
import { useCafe } from '@/components/cafe-provider';
import { short } from '@/lib/types';
export default function Cafes() { const { t } = useLanguage(); 
    const { cafes, health, wallet, blocked, selectCafe, ready, error } = useCafe();
    return <section className="page-section"><div className="page-heading"><p className="eyebrow">{t("MANY LITTLE CAFÉS, ONE COMMUNITY")}</p><h1>{t("Meet the cafés")}</h1><p>{t("Each café has its own recipes, its own barista, and a little personality.")}</p><p className="hint">{t("Deploy your workshop contract, then share its café manifest with the host to join this directory.")}</p><Link className="text-link" href="/menu?cafe=all">{t("Explore the community menu ↗")}</Link></div><div className="cafe-directory">{cafes.map(cafe => {
            const status = health.find(h => h.cafe.contractId === cafe.contractId);
            return <article className="panel" key={cafe.contractId}><p className="eyebrow">{cafe.owner === wallet ? t("✦ YOUR CAFÉ") : cafe.owner ? t("☕ PARTICIPANT CAFÉ") : t("☕ SHARED CAFÉ")}</p><h2>{cafe.name}</h2><p className="byline">{cafe.owner ? `by ${short(cafe.owner)}` : t("Open to community creations")}</p><p className={status?.error ? 'error' : 'hint'}>{status?.error ? t("Catching up · Other cafés remain open") : status?.lastUpdated ? t("Connected to Testnet") : t("Checking this café…")}</p>{status?.error && <p className="hint" role="status">{status.error}</p>}<details><summary>{t("Café details")}</summary><p>{t("Contract")} <code>{cafe.contractId}</code></p><p>Barista <code>{cafe.barista}</code></p>{<p>{t("Approved WASM")} <code>{cafe.wasmHash}</code></p>}{status?.lastUpdated && <p>{t("Last checked:")} {new Date(status.lastUpdated).toLocaleTimeString()}</p>}</details><Link className="button primary" aria-disabled={blocked} href={`/menu?cafe=${encodeURIComponent(cafe.contractId)}`} onClick={event => { if (blocked)
                event.preventDefault();
            else
                selectCafe(cafe.contractId); }}>{t("Visit café ↗")}</Link>{cafe.owner === wallet && <Link className="text-link" href={`/create?cafe=${encodeURIComponent(cafe.contractId)}`}>{t("Create a recipe ↗")}</Link>}</article>;
        })}</div>{!cafes.length && <p className="board-empty">{!ready ? t("Opening the café directory…") : error ? 'The on-chain directory is unavailable. Ask the host to check Testnet.' : 'No cafés approved yet. The host can publish the first café on-chain.'}</p>}</section>;
}
