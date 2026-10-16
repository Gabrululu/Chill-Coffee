'use client';
import { LanguageSwitcher, useLanguage } from "@/components/language-provider";
import { CafeSelectionSync } from './cafe-picker';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectWallet } from './connect-wallet';
import { CafeStatus } from './cafe-status';
import { useWallet } from './wallet-provider';
export function Shell({ children }: {
    children: React.ReactNode;
}) { const { t } = useLanguage();  const path = usePathname(); const { snapshot } = useWallet(); return <><div className="network-strip"><span className="dot"/> STELLAR TESTNET <span className="strip-separator">/</span> {t("NO REAL FUNDS")} <span className="strip-right">{t("LIVE CAFÉ · STELLAR TESTNET")}</span></div><header><Link href="/" className="brand"><span className="brand-mark">☕</span><span>Stellar Chill Café<small>{t("A LITTLE COFFEE. A LITTLE COSMOS.")}</small></span></Link><nav aria-label={t("Main navigation")}>{[['/cafes', 'Cafés'], ['/menu', t("The menu")], ['/create', t("Create a recipe")], ['/barista', 'Barista'], ['/live', t("Live café")], ['/leaderboard', 'Leaderboard']].map(([href, label]) => <Link key={href} href={href} className={path === href ? 'active' : ''}>{label}</Link>)}</nav><div className="header-actions"><LanguageSwitcher/><ConnectWallet /></div></header><main><CafeSelectionSync/>{snapshot.status === 'wrong-network' && <div className="wallet-preview-note" role="alert">{t("Freighter is on another network. Switch to Testnet to sign.")}</div>}<CafeStatus/>{children}</main><footer><Link className="footer-brand" href="/">☕ Stellar Chill Café</Link><span>{t("Made for slow sips & bright ideas.")}</span><span className="footer-end"><span className="dot"/> {t("Testnet only")} <span>✦</span> {t("Built on Stellar")}</span></footer></>; }
