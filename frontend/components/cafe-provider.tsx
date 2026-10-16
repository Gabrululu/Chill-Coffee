'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { type MenuItem, type Order, type Recipe } from '@/lib/types';
import { useWallet } from './wallet-provider';
import { errorMessage, WalletError } from '@/lib/stellar/errors';
import { fetchDirectory, type CafeEntry } from '@/lib/cafe/registry';
import { createCommunityReader, type CafeHealth } from '@/lib/cafe/community';
import { visibleCafeData } from '@/lib/cafe/visibility';
import { createCafeSyncLoop } from '@/lib/cafe/sync-loop';
import { transactionBusy, type TransactionState } from '@/lib/stellar/transaction';
type Data = {
    items: MenuItem[];
    orders: Order[];
};
type Cafe = Data & {
    cafes: CafeEntry[];
    health: CafeHealth[];
    selectedCafeId: string;
    selectCafe: (id: string) => void;
    online: boolean;
    nextRefreshAt: number | null;
    ready: boolean;
    loading: boolean;
    error: string | null;
    lastUpdated: number | null;
    wallet: string | null;
    barista: string | null;
    connected: boolean;
    blocked: boolean;
    transaction: TransactionState;
    connect: () => void;
    register: (r: Recipe, cafeId?: string) => Promise<string>;
    order: (i: MenuItem) => Promise<string>;
    serve: (id: string) => Promise<string>;
    refresh: () => Promise<void>;
    notice: string;
    setNotice: (s: string) => void;
};
const Context = createContext<Cafe | null>(null);
export function CafeProvider({ children }: {
    children: ReactNode;
}) {
    const live = useWallet();
    const [data, setData] = useState<Data>({ items: [], orders: [] });
    const [cafes, setCafes] = useState<CafeEntry[]>([]);
    const [health, setHealth] = useState<CafeHealth[]>([]);
    const [selectedCafeId, setSelectedCafeId] = useState('all');
    const directoryRef = useRef<CafeEntry[]>([]);
    const community = useRef<ReturnType<typeof createCommunityReader> | null>(null);
    const [online, setOnline] = useState(true);
    const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [barista, setBarista] = useState<string | null>(null);
    const [notice, setNotice] = useState('');
    const inFlight = useRef<Promise<boolean> | null>(null);
    const mounted = useRef(true);
    const confirmedHash = useRef<string | null>(null);
    const fullRead = useRef(false);
    const queuedFullRead = useRef<Promise<boolean> | null>(null);
    const refresh = useCallback((force = true): Promise<boolean> => {
        if (!mounted.current || !navigator.onLine)
            return Promise.resolve(false);
        if (inFlight.current) {
            if (force && !fullRead.current) {
                if (!queuedFullRead.current)
                    queuedFullRead.current = inFlight.current.then(() => { queuedFullRead.current = null; return refresh(true); });
                return queuedFullRead.current;
            }
            return inFlight.current;
        }
        setLoading(true);
        fullRead.current = force;
        const request = (async () => {
            try {
                let directoryError: string | null = null;
                try {
                    const directory = await fetchDirectory();
                    directoryRef.current = directory.cafes;
                    if (mounted.current) {
                        setCafes(directory.cafes);
                        setSelectedCafeId(current => current === 'all' || directory.cafes.some(c => c.contractId === current) ? current : 'all');
                    }
                }
                catch (failure) {
                    if (!directoryRef.current.length)
                        throw failure;
                    directoryError = errorMessage(failure);
                }
                if (!directoryRef.current.length) {
                    if (!mounted.current) return false;
                    setData({items:[],orders:[]}); setHealth([]); setBarista(null);
                    setError(directoryError); setLastUpdated(Date.now()); return !directoryError;
                }
                const { readCafeSnapshot, probeCafeChanges, server } = await import('@/lib/stellar/cafe-contract');
                if (!community.current)
                    community.current = createCommunityReader({ read: readCafeSnapshot, probe: (ledger, cafe) => probeCafeChanges(ledger, server, cafe.contractId) });
                const result = await community.current(directoryRef.current, force);
                if (!mounted.current)
                    return false;
                setData(visibleCafeData(result));
                setHealth(result.health);
                setBarista(result.health.find(h => !h.error)?.cafe.barista ?? null);
                const failures = result.health.filter(h => h.error);
                setError(directoryError ?? (failures.length ? `${failures.length} café(s) need attention. Other cafés remain available; see the café directory.` : null));
                if (result.success)
                    setLastUpdated(Date.now());
                return result.success;
            }
            catch (failure) {
                if (mounted.current)
                    setError(errorMessage(failure));
                return false;
            }
            finally {
                if (mounted.current) {
                    setLoading(false);
                    setReady(true);
                }
                inFlight.current = null;
            }
        })();
        inFlight.current = request;
        return request;
    }, []);
    useEffect(() => {
        mounted.current = true;
        const loop = createCafeSyncLoop({ read: refresh, isActive: () => !document.hidden && navigator.onLine,
            scheduled: at => { if (mounted.current)
                setNextRefreshAt(at); } });
        setOnline(navigator.onLine);
        const wake = () => { setOnline(navigator.onLine); loop.wake(); };
        const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('stellar-cafe-testnet-updates') : null;
        if (channel)
            channel.onmessage = () => loop.wake();
        loop.start();
        window.addEventListener('focus', wake);
        window.addEventListener('online', wake);
        window.addEventListener('offline', wake);
        document.addEventListener('visibilitychange', wake);
        return () => { mounted.current = false; loop.stop(); channel?.close(); window.removeEventListener('focus', wake); window.removeEventListener('online', wake); window.removeEventListener('offline', wake); document.removeEventListener('visibilitychange', wake); };
    }, [refresh]);
    useEffect(() => { if (notice) {
        const timer = setTimeout(() => setNotice(''), 5000);
        return () => clearTimeout(timer);
    } }, [notice]);
    useEffect(() => {
        if (live.transaction.stage !== 'confirmed' || !live.transaction.hash || confirmedHash.current === live.transaction.hash)
            return;
        confirmedHash.current = live.transaction.hash;
        // A read already underway may predate confirmation; follow it with a fresh read.
        void (async () => { if (inFlight.current)
            await inFlight.current; await refresh(); })();
        const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('stellar-cafe-testnet-updates') : null;
        channel?.postMessage({ confirmed: live.transaction.hash });
        channel?.close();
    }, [live.transaction.stage, live.transaction.hash, refresh]);
    const register = async (recipe: Recipe, cafeId?: string): Promise<string> => {
        const target = cafeId ? cafes.find(c => c.contractId === cafeId) : cafes.find(c => c.contractId === selectedCafeId) ?? cafes.find(c => c.owner === live.snapshot.address) ?? cafes.find(c => c.owner === null);
        if (!target)
            throw new WalletError('missing-cafe', 'Choose your café. Ask the host to add your deployed contract to the event directory.');
        if (target.owner && target.owner !== live.snapshot.address)
            throw new WalletError('not-cafe-owner', 'Connect the owner wallet to create in this café.');
        return live.prepareCafe({ kind: 'register', recipe, target });
    };
    const order = async (item: MenuItem): Promise<string> => {
        if (!item.price_stroops)
            throw new WalletError('invalid-item', 'Refresh the menu to load a confirmed Testnet creation.');
        const target = cafes.find(c => c.contractId === item.cafe_id);
        if (!target || !item.chain_id)
            throw new WalletError('missing-cafe', 'This café left the directory. Refresh the menu.');
        return live.prepareCafe({ target, kind: 'order', itemId: item.chain_id, priceStroops: item.price_stroops, creator: item.creator, name: item.name });
    };
    const serve = async (id: string): Promise<string> => {
        const order = data.orders.find(o => o.id === id);
        if (!order)
            throw new WalletError('missing-order', 'Refresh the barista queue first.');
        const target = cafes.find(c => c.contractId === order.cafe_id);
        if (!target || !order.chain_id)
            throw new WalletError('missing-cafe', 'This café left the directory. Refresh the queue.');
        return live.prepareCafe({ target, kind: 'serve', orderId: order.chain_id, name: data.items.find(item => item.id === order.item_id)?.name || `order #${id}` });
    };
    return <Context.Provider value={{ items: selectedCafeId === 'all' ? data.items : data.items.filter(i => i.cafe_id === selectedCafeId), orders: selectedCafeId === 'all' ? data.orders : data.orders.filter(o => o.cafe_id === selectedCafeId), cafes, health, selectedCafeId, selectCafe: id => { if (!transactionBusy(live.transaction.stage) && !['review', 'unknown'].includes(live.transaction.stage) && (id === 'all' || cafes.some(c => c.contractId === id)))
            setSelectedCafeId(id); }, online, nextRefreshAt, ready, loading, error, lastUpdated, barista, wallet: live.snapshot.address, connected: live.snapshot.status === 'connected', blocked: (transactionBusy(live.transaction.stage) || ['review', 'unknown'].includes(live.transaction.stage)), transaction: live.transaction, connect: () => live.setPanelOpen(true), register, order, serve, refresh: async () => { await refresh(); }, notice, setNotice }}>{children}{notice && <div role="status" className="toast">✦ {notice}</div>}</Context.Provider>;
}
export function useCafe() { const cafe = useContext(Context); if (!cafe)
    throw new Error('Missing CafeProvider'); return cafe; }
