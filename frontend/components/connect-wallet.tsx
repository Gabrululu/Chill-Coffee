'use client';
import { useLanguage } from "@/components/language-provider";
import { useWallet } from './wallet-provider';
import { short } from '@/lib/types';
import { transactionBusy } from '@/lib/stellar/transaction';
export function ConnectWallet() { const { t } = useLanguage(); 
    const { snapshot, transaction, setPanelOpen } = useWallet();
    const pending = transactionBusy(transaction.stage);
    let label = t("Connect wallet");
    if (snapshot.status === 'connecting')
        label = t("Connecting…");
    else if (snapshot.status === 'wrong-network')
        label = t("Switch to Testnet");
    else if (pending)
        label = t("Transaction pending…");
    else if (snapshot.address)
        label = short(snapshot.address);
    return <button className={`wallet ${snapshot.status === 'wrong-network' ? 'wallet-wrong' : ''}`} onClick={() => setPanelOpen(true)} aria-label={`${label}. Open Freighter wallet panel`}>
    <span className="wallet-icon" aria-hidden="true">▣</span><span aria-live="polite">{label}</span><span aria-hidden="true">↗</span>
  </button>;
}
