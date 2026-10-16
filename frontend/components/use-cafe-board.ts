'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCafe } from './cafe-provider';
import { cafeBoard, cafeChanges, changeMessage, type CafeData } from '@/lib/cafe/board';
export function useBoardClock() {
    const [now, setNow] = useState(0);
    useEffect(() => {
        const tick = () => { if (!document.hidden)
            setNow(Date.now()); };
        tick();
        const timer = setInterval(tick, 15000);
        document.addEventListener('visibilitychange', tick);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
    }, []);
    return now;
}
export function useCafeBoard(minutes = 30) {
    const { items, orders, ready, lastUpdated } = useCafe();
    const now = useBoardClock();
    const previous = useRef<CafeData | null>(null);
    const [update, setUpdate] = useState({ items: [] as string[], message: '', at: 0 });
    useEffect(() => {
        if (!ready || (!lastUpdated))
            return;
        const changes = cafeChanges(previous.current, { items, orders });
        previous.current = { items, orders };
        const message = changeMessage(changes);
        if (message)
            setUpdate({ items: changes.items, message, at: Date.now() });
    }, [items, orders, ready, lastUpdated]);
    const board = useMemo(() => cafeBoard({ items, orders }, now, minutes), [items, orders, now, minutes]);
    const fresh = update.at > 0 && now - update.at < 30000;
    return { ...board, now, message: fresh ? update.message : '', highlighted: fresh ? update.items : [] };
}
