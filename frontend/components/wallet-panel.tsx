'use client';
import { useLanguage } from "@/components/language-provider";
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { tipBlock } from '@/lib/cafe/action-readiness';
import { useCafe } from './cafe-provider';
import { useWallet } from './wallet-provider';
import { short } from '@/lib/types';
import { formatStroops } from '@/lib/stellar/amount';
import { transactionUrl } from '@/lib/stellar/config';
import { transactionBusy, type TransactionStage } from '@/lib/stellar/transaction';
const labels: Record<TransactionStage, string> = {
    idle: '', preparing: 'Preparing your café transaction…', review: 'Ready for your review',
    'awaiting-signature': 'Waiting for your signature in Freighter…', submitting: 'Sending to Stellar…',
    pending: 'Brewing on-chain…', confirmed: 'Confirmed on Stellar ✓', failed: 'Your transaction did not complete', unknown: 'Waiting for a clear confirmation',
};
export function WalletPanel() {
    const wallet = useWallet();
    if (!wallet.panelOpen || false)
        return null;
    return <WalletDialog />;
}
function WalletDialog() { const { t } = useLanguage(); 
    const { snapshot, account, accountError, funding, transaction, barista, configError, setPanelOpen, connect, disconnect, refresh, loadBarista, fund, prepareThankYou, signOperation, checkTransaction, clearTransaction } = useWallet();
    const { cafes, selectedCafeId, ready, loading, error: directoryError, refresh: refreshCafes } = useCafe();
    const tipTarget = cafes.find(c => c.contractId === selectedCafeId) ?? cafes.find(c => c.owner === snapshot.address) ?? cafes[0];
    const dialog = useRef<HTMLDialogElement>(null);
    const path = usePathname();
    const connected = snapshot.status === 'connected';
    const tipReason = tipBlock({ connected, ready, loading, error: directoryError, cafes, hasTarget: !!tipTarget, account, accountError, barista, configError, selfTip: snapshot.address === barista, funding });
    const busy = transactionBusy(transaction.stage);
    const unresolved = transaction.stage === 'unknown';
    const terminal = transaction.stage === 'confirmed' || transaction.stage === 'failed';
    useEffect(() => { dialog.current?.showModal(); if (tipTarget)
        void loadBarista(tipTarget); }, [loadBarista, tipTarget]);
    return <dialog ref={dialog} className="wallet-dialog" aria-labelledby="wallet-title" onCancel={() => setPanelOpen(false)}>
    <button className="close" aria-label="Close wallet panel" onClick={() => setPanelOpen(false)}>×</button>
    <p className="eyebrow">YOUR LITTLE CORNER OF TESTNET</p>
    <h2 id="wallet-title">A seat at the café</h2>
    <p className="wallet-intro">Connect Freighter and bring a little Stellar magic.<br />Testnet only. No real funds.</p>
    <div className={`wallet-status status-${snapshot.status}`} role="status"><span className="dot"/>{snapshot.status === 'connected' ? 'Connected to Stellar Testnet' : snapshot.status === 'wrong-network' ? 'Wrong network' : snapshot.status === 'connecting' ? 'Connecting to Freighter…' : snapshot.status === 'unavailable' ? 'Freighter not found' : 'Not connected'}</div>
    {snapshot.error && <p className="error" role="alert">{snapshot.error}</p>}
    {snapshot.status === 'unavailable' && <a className="text-link" href="https://www.freighter.app/" target="_blank" rel="noreferrer">Get the Freighter extension ↗</a>}
    {snapshot.address && <div className="wallet-address"><span>YOUR ACCOUNT</span><code>{snapshot.address}</code><div className="wallet-small-actions"><button onClick={() => { void refresh(); }} disabled={busy || funding}>Refresh connection</button><button onClick={disconnect} disabled={busy || funding}>Disconnect</button></div></div>}
    {!snapshot.address && <button className="button primary full" disabled={snapshot.status === 'connecting' || busy} onClick={() => { void connect(); }}>{snapshot.status === 'connecting' ? 'Opening Freighter…' : 'Connect with Freighter ↗'}</button>}
    {snapshot.status === 'wrong-network' && <p className="hint">Open Freighter → Settings → Network → Testnet. Return here and refresh. Signing and funding stay disabled until the network matches.</p>}
    {connected && path === '/create' && transaction.stage === 'idle' && cafes.length > 0 && <div className="transaction-status">
      <p>{t('Wallet connected. Return to your recipe and choose Register on Stellar to prepare it. Then review and select Sign with Freighter.')}</p>
      <button className="button primary full" onClick={() => setPanelOpen(false)}>{t('Continue with my recipe →')}</button>
    </div>}
    {connected && <div className="wallet-balance"><div><span>TESTNET BALANCE</span><strong>{account ? `${account.balance} XLM` : accountError ? 'Balance unavailable' : 'Checking balance…'}</strong></div>{account && !account.funded && <button className="button" disabled={funding || busy} onClick={() => { void fund(); }}>{funding ? 'Asking Friendbot…' : 'Get Testnet XLM ↗'}</button>}</div>}
    {accountError && <p className="error" role="alert">{accountError}</p>}
    <section className="wallet-thanks">
      {transaction.stage === 'idle' ? <>
        <p className="eyebrow">A LITTLE THANK-YOU FOR THE BARISTA</p><h3>Leave a cozy 0.1 XLM tip ☕</h3>
        <p>{tipTarget?.name} · An optional Testnet payment. Review the network fee before signing.</p>
        <div className="receipt"><span>Barista</span><code>{tipTarget ? barista || t('Checking the café recipient…') : t('No approved café available')}</code><span>Amount</span><strong>0.1 Testnet XLM</strong><span>{t("Contract")}</span><code>{tipTarget ? short(tipTarget.contractId) : 'No café selected'}</code></div>
        {configError && <><p className="error" role="alert">{configError}</p><button className="text-link" onClick={() => { void loadBarista(tipTarget); }}>Check the café again ↗</button></>}
        <button className="button primary full" disabled={!!tipReason} aria-describedby={tipReason ? "tip-reason" : undefined} onClick={() => { void prepareThankYou(tipTarget); }}>Prepare my thank-you →</button>
        {tipReason && <p id="tip-reason" className="hint" role="status">{t(tipReason)}</p>}
        {!cafes.length && <button className="text-link" disabled={loading} onClick={() => { void refreshCafes(); }}>{t('Refresh café directory ↻')}</button>}
        {connected && snapshot.address === barista && <p className="hint">Another participant can send a thank-you to your barista account.</p>}
      </> : <>
        <p className="eyebrow">YOUR CAFÉ TRANSACTION</p><h3>{transaction.title || 'Brewing on Stellar'}</h3>
        <div className="transaction-status" role="status" aria-live="polite">
          <strong>{t(labels[transaction.stage])}</strong>
          {transaction.amountStroops && <p>Payment: {formatStroops(transaction.amountStroops)} Testnet XLM</p>}
          {transaction.fee && <p>Estimated maximum network fee: {formatStroops(transaction.fee)} XLM</p>}
          {transaction.cafeName && <p>Café: {transaction.cafeName}</p>}
          {transaction.contractId && <p>{t("Contract")} <code>{transaction.contractId}</code></p>}
          {transaction.account && <p>From <code>{transaction.account}</code></p>}
          {transaction.destination && <p>{transaction.kind === 'order' ? t("Creator") : 'To'} <code>{transaction.destination}</code></p>}
          {transaction.stage === 'confirmed' && transaction.kind === 'order' && <p>☕ Order confirmed! Your order is now in the barista queue.</p>}
          {transaction.kind === 'register' && <p>Your recipe will be stored on-chain. Only the network fee applies.</p>}
          {transaction.kind === 'serve' && <p>Mark order #{transaction.orderId} as served. Only the network fee applies.</p>}
          {transaction.stage === 'confirmed' && transaction.kind !== 'tip' && !transaction.entityId && <p>Loading the confirmed item/order ID…</p>}
          {transaction.entityId && <p>{transaction.kind === 'register' ? 'Item ID' : 'Order ID'}: #{transaction.entityId}</p>}
          {transaction.itemId && <p>Item #{transaction.itemId}</p>}
          {transaction.hash && <a href={transactionUrl(transaction.hash)} target="_blank" rel="noreferrer">View transaction on Stellar ↗<code>{transaction.hash}</code></a>}
        </div>
        {transaction.error && <p className="error" role="alert">{transaction.error}</p>}
        {transaction.stage === 'review' && <div className="actions"><button className="button" onClick={clearTransaction}>{t("Cancel")}</button><button className="button primary" disabled={!connected || funding} onClick={() => { void signOperation(); }}>{transaction.kind === 'order' || transaction.kind === 'tip' ? `Pay ${formatStroops(transaction.amountStroops || '0')} XLM with Freighter ↗` : t('Sign with Freighter ↗')}</button></div>}
        {transaction.stage === 'confirmed' && transaction.kind !== 'tip' && !transaction.entityId && <button className="button full" onClick={() => { void checkTransaction(); }}>Load receipt details</button>}
        {unresolved && <button className="button full" onClick={() => { void checkTransaction(); }}>Check confirmation</button>}
        {terminal && <button className="button full" onClick={clearTransaction}>{transaction.stage === 'confirmed' ? 'Back to the café ✓' : 'Back to my wallet'}</button>}
        {busy && <p className="hint">{transaction.stage === 'awaiting-signature' ? 'Review and approve in Freighter. You can cancel there.' : 'You can close this panel; the transaction hash is saved before sending.'}</p>}
      </>}
    </section>
    <p className="hint">Testnet only · No real funds. Disconnecting here does not revoke Freighter’s site permission.</p>
  </dialog>;
}
