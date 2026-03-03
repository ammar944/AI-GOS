'use client';

import { useState, useEffect, useRef } from 'react';
import { buildSubsectionCards } from '@/components/journey/intel-cards/build-subsection-cards';
import type { SubsectionCard } from '@/components/journey/intel-cards/build-subsection-cards';

export function useSubsectionReveal(
  sectionKey: string,
  data: Record<string, unknown> | null | undefined,
  status: 'pending' | 'running' | 'complete' | 'error',
  delayMs = 1500
): SubsectionCard[] {
  const [revealed, setRevealed] = useState<SubsectionCard[]>([]);
  const scheduledRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Only schedule once — guard prevents re-runs when `data` reference changes
    // (chat re-renders cause JSON.parse to produce new object references)
    if (status !== 'complete' || !data || scheduledRef.current) return;
    scheduledRef.current = true;

    const cards = buildSubsectionCards(sectionKey, data);
    cards.forEach((card, index) => {
      const timer = setTimeout(() => {
        setRevealed((prev) => [...prev, card]);
      }, index * delayMs);
      timersRef.current.push(timer);
    });
    // No cleanup return here — timers must survive parent re-renders.
    // Unmount cleanup lives in the dedicated effect below.
  }, [status, sectionKey, data, delayMs]);

  // Cancel pending timers only on real component unmount
  useEffect(() => {
    const timers = timersRef;
    return () => { timers.current.forEach(clearTimeout); };
  }, []);

  // Reset if section goes back to non-complete (edge case)
  useEffect(() => {
    if (status === 'pending' || status === 'running') {
      setRevealed([]);
      scheduledRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
  }, [status]);

  return revealed;
}
