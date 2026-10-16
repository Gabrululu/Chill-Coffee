'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCafe } from './cafe-provider';
// Preserve café links and selection without a global control panel.
export function CafeSelectionSync() {
  return <Suspense fallback={null}><SelectionSync/></Suspense>;
}
function SelectionSync() {
  const {cafes, selectedCafeId, selectCafe, blocked} = useCafe();
  const requested = useSearchParams().get('cafe');
  useEffect(() => {
    if (!blocked && requested && (requested === 'all' || cafes.some(cafe => cafe.contractId === requested)) && selectedCafeId !== requested) selectCafe(requested);
  }, [requested, cafes, selectedCafeId, selectCafe, blocked]);
  return null;
}
