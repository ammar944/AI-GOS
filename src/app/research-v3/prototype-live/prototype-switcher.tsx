// prototype-switcher.tsx — PROTOTYPE. Floating variant switcher (throwaway).
'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type VariantKey = 'A' | 'B' | 'C' | 'D';

const ORDER: VariantKey[] = ['A', 'B', 'C', 'D'];

const DEFAULT_NAMES: Record<VariantKey, string> = {
  A: 'Mission Control',
  B: 'Agent Roster',
  C: 'Research Console',
  D: 'Simple Stream',
};

function normalize(raw: string | null): VariantKey {
  return raw === 'B' || raw === 'C' || raw === 'D' ? raw : 'A';
}

export interface PrototypeSwitcherProps {
  names?: Record<VariantKey, string>;
}

export function PrototypeSwitcher({ names = DEFAULT_NAMES }: PrototypeSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = normalize(searchParams.get('variant'));

  const goTo = useCallback(
    (next: VariantKey) => {
      router.replace(`${pathname}?variant=${next}`);
    },
    [router, pathname],
  );

  const cycle = useCallback(
    (dir: 1 | -1) => {
      const idx = ORDER.indexOf(current);
      const nextIdx = (idx + dir + ORDER.length) % ORDER.length;
      goTo(ORDER[nextIdx]);
    },
    [current, goTo],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      cycle(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cycle]);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900 px-1.5 py-1.5 text-neutral-100 shadow-lg shadow-black/30">
        <button
          type="button"
          aria-label="Previous variant"
          onClick={() => cycle(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          {'◀'}
        </button>
        <span className="min-w-[12rem] px-3 text-center text-sm font-medium tabular-nums">
          {current} {'—'} {names[current]}
        </span>
        <button
          type="button"
          aria-label="Next variant"
          onClick={() => cycle(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          {'▶'}
        </button>
      </div>
    </div>
  );
}
