'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DISCONNECTED, type WalletSnapshot } from '@/lib/stellar/wallet-state';
import { errorMessage, WalletError } from '@/lib/stellar/errors';
import { IDLE, submitTransaction, trackTransaction, transactionBusy, type TransactionState } from '@/lib/stellar/transaction';
import { requireCurrentApproval, type CafeTarget } from '@/lib/cafe/registry';
import type { AccountInfo } from '@/lib/stellar/account';
import type { CafeAction, PreparedOperation } from '@/lib/stellar/cafe-contract';
const OPT_IN = 'stellar-cafe-freighter-session-v1';
const RECEIPT = 'stellar-cafe-testnet-transaction-v1';
type WalletContextValue = {
    snapshot: WalletSnapshot;
    account: AccountInfo | null;
    accountError: string | null;
    panelOpen: boolean;
    setPanelOpen: (open: boolean) => void;
    funding: boolean;
    transaction: TransactionState;
    barista: string | null;
    configError: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    refresh: () => Promise<void>;
    loadBarista: (target?: CafeTarget) => Promise<void>;
    fund: () => Promise<void>;
    prepareThankYou: (target?: CafeTarget) => Promise<void>;
    prepareCafe: (action: CafeAction) => Promise<string>;
    signOperation: () => Promise<void>;
    checkTransaction: () => Promise<void>;
    clearTransaction: () => void;
};
const Context = createContext<WalletContextValue | null>(null);
export function WalletProvider({ children }: {
    children: ReactNode;
}) {
    const [snapshot, setSnapshot] = useState<WalletSnapshot>(DISCONNECTED);
    const [account, setAccount] = useState<AccountInfo | null>(null);
    const [accountError, setAccountError] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [transaction, setTransaction] = useState<TransactionState>(IDLE);
    const [barista, setBarista] = useState<string | null>(null);
    const [configError, setConfigError] = useState<string | null>(null);
    const [funding, setFunding] = useState(false);
    const active = useRef(false);
    const connecting = useRef(false);
    const refreshing = useRef(false);
    const epoch = useRef(0);
    const locked = useRef(false);
    const fundingLock = useRef(false);
    const configEpoch = useRef(0);
    const prepared = useRef<PreparedOperation | null>(null);
    const txRef = useRef<TransactionState>(IDLE);
    const snapshotRef = useRef<WalletSnapshot>(DISCONNECTED);
    const commit = useCallback((patch: TransactionState) => {
        const next = { ...txRef.current, ...patch, error: patch.error };
        if (next.hash) {
            try {
                localStorage.setItem(RECEIPT, JSON.stringify(next));
            }
            catch {
                // Do not send if we cannot save the hash needed after a reload/timeout.
                if (next.stage === 'submitting')
                    throw new WalletError('storage-unavailable', 'Enable browser storage before sending, so the transaction can be recovered safely. Nothing was sent.');
            }
        }
        txRef.current = next;
        setTransaction(next);
    }, []);
    const applySnapshot = useCallback((next: WalletSnapshot) => {
        const old = snapshotRef.current;
        if (next.address !== old.address || next.status !== old.status) {
            setAccount(null);
            setAccountError(null);
            prepared.current = null;
            if (txRef.current.stage === 'review')
                commit({ stage: 'failed', error: 'Wallet changed. Prepare and review the café operation again.' });
        }
        snapshotRef.current = next;
        setSnapshot(next);
    }, [commit]);
    const loadBalance = useCallback(async (address: string, version: number) => {
        try {
            const { getAccountInfo } = await import('@/lib/stellar/account');
            const info = await getAccountInfo(address);
            if (epoch.current === version && snapshotRef.current.address === address && snapshotRef.current.status === 'connected') {
                setAccount(info);
                setAccountError(null);
            }
        }
        catch (error) {
            if (epoch.current === version && snapshotRef.current.address === address) {
                setAccount(null);
                setAccountError(errorMessage(error));
            }
        }
    }, []);
    const refresh = useCallback(async (afterTransaction = false) => {
        if (!active.current || connecting.current || (locked.current && !afterTransaction) || refreshing.current)
            return;
        refreshing.current = true;
        const version = ++epoch.current;
        try {
            const [api, {readWallet}] = await Promise.all([import('@stellar/freighter-api'), import('@/lib/stellar/wallet-session')]);
            const next = await readWallet(api);
            if (epoch.current !== version || !active.current)
                return;
            applySnapshot(next);
            if (next.status === 'connected' && next.address)
                void loadBalance(next.address, version);
        }
        catch (error) {
            if (epoch.current !== version || !active.current)
                return;
            applySnapshot({ ...DISCONNECTED, status: error instanceof WalletError && error.code === 'missing-extension' ? 'unavailable' : 'error', error: errorMessage(error) });
        }
        finally { refreshing.current = false; }
    }, [applySnapshot, loadBalance]);
    const connect = useCallback(async () => {
        if (connecting.current || locked.current)
            return;
        connecting.current = true;
        active.current = true;
        const version = ++epoch.current;
        applySnapshot({ ...DISCONNECTED, status: 'connecting' });
        try {
            const [api, {readWallet}] = await Promise.all([import('@stellar/freighter-api'), import('@/lib/stellar/wallet-session')]);
            const next = await readWallet(api, true);
            if (epoch.current !== version || !active.current)
                return;
            applySnapshot(next);
            try {
                sessionStorage.setItem(OPT_IN, 'true');
            }
            catch { /* Connection still works without session restore. */ }
            if (next.status === 'connected' && next.address)
                void loadBalance(next.address, version);
        }
        catch (error) {
            if (epoch.current !== version || !active.current)
                return;
            applySnapshot({ ...DISCONNECTED, status: error instanceof WalletError && error.code === 'missing-extension' ? 'unavailable' : 'error', error: errorMessage(error) });
        }
        finally {
            connecting.current = false;
        }
    }, [applySnapshot, loadBalance]);
    const disconnect = useCallback(() => {
        active.current = false;
        ++epoch.current;
        try {
            sessionStorage.removeItem(OPT_IN);
        }
        catch { /* Local disconnect remains effective. */ }
        applySnapshot(DISCONNECTED);
        setAccount(null);
        prepared.current = null;
    }, [applySnapshot]);
    const cancelPendingReads = useCallback(() => { ++epoch.current; }, []);
    useEffect(() => {
        let disposed = false;
        void (async () => {
        try {
            const saved = JSON.parse(localStorage.getItem(RECEIPT) || 'null') as TransactionState | null;
            if (saved && saved.hash && /^[a-f0-9]{64}$/.test(saved.hash) && ['submitting', 'pending', 'unknown', 'confirmed', 'failed'].includes(saved.stage) && typeof saved.account === 'string' && /^G[A-Z2-7]{55}$/.test(saved.account) && typeof saved.contractId === 'string' && /^C[A-Z2-7]{55}$/.test(saved.contractId)) {
                const { StrKey } = await import('@stellar/stellar-sdk/base');
                if (disposed || !StrKey.isValidContract(saved.contractId)) return;
                const safe: TransactionState = { stage: saved.stage === 'failed' ? 'failed' : 'unknown', hash: saved.hash, account: saved.account, contractId: saved.contractId, requestId: /^[a-f0-9]{64}$/.test(saved.requestId || '') ? saved.requestId : undefined, fee: /^\d+$/.test(saved.fee || '') ? saved.fee : undefined };
                if (['tip', 'register', 'order', 'serve'].includes(saved.kind || ''))
                    safe.kind = saved.kind;
                else
                    safe.kind = 'tip'; // Phase 3 receipts were tips only.
                if (typeof saved.operationId === 'string' && /^[a-f0-9-]{36}$/.test(saved.operationId))
                    safe.operationId = saved.operationId;
                if (typeof saved.cafeName === 'string')
                    safe.cafeName = saved.cafeName.slice(0, 60);
                if (typeof saved.title === 'string')
                    safe.title = saved.title.slice(0, 120);
                for (const key of ['itemId', 'orderId', 'entityId', 'amountStroops'] as const)
                    if (typeof saved[key] === 'string' && /^\d{1,39}$/.test(saved[key]!))
                        safe[key] = saved[key];
                if (typeof saved.destination === 'string' && /^G[A-Z2-7]{55}$/.test(saved.destination))
                    safe.destination = saved.destination;
                txRef.current = safe;
                setTransaction(safe);
            }
            if (sessionStorage.getItem(OPT_IN) === 'true') {
                active.current = true;
                void refresh();
            }
        }
        catch { /* Malformed or blocked browser storage never initiates a transaction. */ }
        })();
        const onFocus = () => { void refresh(); };
        window.addEventListener('focus', onFocus);
        return () => { disposed = true; window.removeEventListener('focus', onFocus); cancelPendingReads(); };
    }, [refresh, cancelPendingReads]);
    useEffect(() => {
        if (!snapshot.address) return;
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        // Schedule the next check after the previous one finishes. No SDK interval
        // can accumulate unanswered extension requests while a popup is open.
        const poll = async () => {
            if (!document.hidden) await refresh();
            if (!disposed) timer = setTimeout(() => { void poll(); }, 15_000);
        };
        const visibility = () => {
            if (!document.hidden) void refresh();
        };
        timer = setTimeout(() => { void poll(); }, 15_000);
        document.addEventListener('visibilitychange', visibility);
        return () => {
            disposed = true;
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [snapshot.address, refresh]);
    // Balance reads happen on account changes, explicit refresh/funding/confirmation.
    // The extension watcher is not a blockchain poller.
    useEffect(() => {
        if (snapshot.status === 'connected' && snapshot.address)
            void loadBalance(snapshot.address, epoch.current);
    }, [snapshot.status, snapshot.address, loadBalance]);
    const loadBarista = useCallback(async (target?: CafeTarget) => {
        const version = ++configEpoch.current;
        setConfigError(null);
        setBarista(null);
        if (!target) return;
        try {
            const { readCafeConfig } = await import('@/lib/stellar/cafe-contract');
            const config = await readCafeConfig(target);
            if (configEpoch.current === version)
                setBarista(config.barista);
        }
        catch (error) {
            if (configEpoch.current === version) {
                setBarista(null);
                setConfigError(errorMessage(error));
            }
        }
    }, []);
    const fund = useCallback(async () => {
        if (fundingLock.current || locked.current)
            return;
        fundingLock.current = true;
        setFunding(true);
        setAccountError(null);
        try {
            const [api, {readWallet, requireWallet}] = await Promise.all([import('@stellar/freighter-api'), import('@/lib/stellar/wallet-session')]);
            const address = requireWallet(await readWallet(api), snapshotRef.current.address || undefined);
            const { fundTestnetAccount } = await import('@/lib/stellar/account');
            const info = await fundTestnetAccount(address);
            if (active.current && snapshotRef.current.address === address)
                setAccount(info);
        }
        catch (error) {
            setAccountError(errorMessage(error));
        }
        finally {
            fundingLock.current = false;
            setFunding(false);
        }
    }, []);
    const prepareOperation = useCallback(async (action: CafeAction | {
        kind: 'tip';
        target?: CafeTarget;
    }): Promise<string> => {
        if (locked.current || transactionBusy(txRef.current.stage) || ['review', 'unknown'].includes(txRef.current.stage)) {
            setPanelOpen(true);
            throw new WalletError('operation-pending', 'Finish or check the current café transaction before starting another.');
        }
        locked.current = true;
        prepared.current = null;
        const operationId = crypto.randomUUID();
        txRef.current = IDLE;
        commit({ stage: 'preparing', kind: action.kind, operationId });
        setPanelOpen(true);
        try {
            const [api, {readWallet, requireWallet}] = await Promise.all([import('@stellar/freighter-api'), import('@/lib/stellar/wallet-session')]);
            if (!active.current)
                throw new WalletError('disconnected', 'Connect Freighter first.');
            const address = requireWallet(await readWallet(api), snapshotRef.current.address || undefined);
            const requestId = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
            const service = await import('@/lib/stellar/cafe-contract');
            let operation: PreparedOperation;
            if (action.kind === 'tip') {
                if (!action.target) throw new WalletError('missing-cafe', 'Choose an approved café before tipping.');
                if (!barista)
                    throw new WalletError('missing-barista', 'Refresh the café configuration first.');
                const tip = await service.prepareTip(address, requestId, barista, action.target);
                operation = { ...tip, kind: 'tip', title: 'Thank the event barista', amountStroops: '1000000' };
            }
            else
                operation = await service.prepareCafeAction(address, requestId, action);
            if (!active.current)
                throw new WalletError('disconnected', 'Wallet disconnected. Nothing was sent.');
            requireWallet(await readWallet(api), address);
            prepared.current = operation;
            const { transaction: _transaction, ...metadata } = operation;
            void _transaction;
            commit({ ...metadata, stage: 'review', operationId });
            return operationId;
        }
        catch (error) {
            commit({ stage: 'failed', error: errorMessage(error) });
            throw error;
        }
        finally {
            locked.current = false;
        }
    }, [barista, commit]);
    const prepareCafe = useCallback((action: CafeAction) => prepareOperation(action), [prepareOperation]);
    const prepareThankYou = useCallback(async (target?: CafeTarget) => { try {
        await prepareOperation({ kind: 'tip', target });
    }
    catch { /* Error is visible in the transaction panel. */ } }, [prepareOperation]);
    const hydrateEntity = useCallback(async () => {
        const state = txRef.current;
        if (state.stage !== 'confirmed' || !state.hash || !state.kind || state.kind === 'tip')
            return;
        try {
            const { readConfirmedEntity } = await import('@/lib/stellar/cafe-contract');
            const entityId = await readConfirmedEntity(state.hash, state.kind, state.contractId);
            if (txRef.current.hash === state.hash && txRef.current.stage === 'confirmed')
                commit({ stage: 'confirmed', entityId });
        }
        catch { /* Confirmation is definitive even if the optional result lookup is unavailable. */ }
    }, [commit]);
    const signOperation = useCallback(async () => {
        if (locked.current || txRef.current.stage !== 'review' || !prepared.current)
            return;
        locked.current = true;
        const tip = prepared.current;
        try {
            const [api, {readWallet, requireWallet, createFreighterSigner}] = await Promise.all([import('@stellar/freighter-api'), import('@/lib/stellar/wallet-session')]);
            if (!active.current)
                throw new WalletError('disconnected', 'Wallet disconnected. Nothing was sent.');
            requireWallet(await readWallet(api), tip.account);
            if (tip.target) {
                await requireCurrentApproval(tip.target);
                const { readCafeConfig } = await import('@/lib/stellar/cafe-contract');
                await readCafeConfig(tip.target);
            }
            commit({ stage: 'awaiting-signature' });
            const [{signReviewedTransaction}, {readHorizonConfirmation}] = await Promise.all([import('@/lib/stellar/sign-reviewed'), import('@/lib/stellar/horizon-confirmation')]);
            const signer = createFreighterSigner(api, tip.account);
            const signed = await signReviewedTransaction(tip.transaction.built, tip.reviewedHash, tip.account, signer);
            if (!active.current) throw new WalletError('disconnected', 'Wallet disconnected. Nothing was sent.');
            requireWallet(await readWallet(api), tip.account);
            const { server, assertTestnet } = await import('@/lib/stellar/cafe-contract');
            await assertTestnet();
            await submitTransaction(server, signed, commit, readHorizonConfirmation);
            await hydrateEntity();
            await refresh(true);
        }
        catch (error) {
            commit({ stage: txRef.current.hash ? 'unknown' : 'failed', error: txRef.current.hash ? 'Check the saved transaction before attempting another café operation.' : errorMessage(error) });
        }
        finally {
            prepared.current = null;
            locked.current = false;
        }
    }, [commit, refresh, hydrateEntity]);
    const checkTransaction = useCallback(async () => {
        if (locked.current || !txRef.current.hash)
            return;
        locked.current = true;
        const hash = txRef.current.hash;
        commit({ stage: 'pending', hash });
        try {
            const [{server}, {readHorizonConfirmation}] = await Promise.all([import('@/lib/stellar/cafe-contract'), import('@/lib/stellar/horizon-confirmation')]);
            // Recovery is read-only; an unavailable getNetwork must not block
            // verification of an existing Testnet envelope through Horizon.
            await trackTransaction(server, hash, commit, readHorizonConfirmation);
            await hydrateEntity();
            await refresh(true);
        }
        catch {
            commit({ stage: 'unknown', hash, error: 'Testnet is unavailable. Your transaction hash is saved; check again later.' });
        }
        finally {
            locked.current = false;
        }
    }, [commit, refresh, hydrateEntity]);
    const clearTransaction = useCallback(() => {
        if (locked.current || transactionBusy(txRef.current.stage) || txRef.current.stage === 'unknown')
            return;
        prepared.current = null;
        txRef.current = IDLE;
        setTransaction(IDLE);
        try {
            localStorage.removeItem(RECEIPT);
        }
        catch { /* The on-chain receipt remains accessible by hash. */ }
    }, []);
    return <Context.Provider value={{ snapshot, account, accountError, panelOpen, setPanelOpen, funding, transaction, barista, configError, connect, disconnect, refresh, loadBarista, fund, prepareThankYou, prepareCafe, signOperation, checkTransaction, clearTransaction }}>{children}</Context.Provider>;
}
export function useWallet() {
    const context = useContext(Context);
    if (!context)
        throw new Error('Missing WalletProvider');
    return context;
}
