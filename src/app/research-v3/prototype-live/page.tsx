// page.tsx — PROTOTYPE route. Replays the frozen real run db41a945 and renders
// one of three throwaway live-run variants. Delete when a winner folds back
// into /research-v3.
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { useReplayAuditState } from './replay';
import { PrototypeSwitcher } from './prototype-switcher';
import type { VariantProps } from './variant-contract';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';
import { VariantD } from './variant-d';

function fmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SelectedVariant(props: VariantProps) {
  const searchParams = useSearchParams();
  const variant = searchParams.get('variant');
  if (variant === 'B') return <VariantB {...props} />;
  if (variant === 'C') return <VariantC {...props} />;
  if (variant === 'D') return <VariantD {...props} />;
  return <VariantA {...props} />;
}

export default function PrototypeLivePage() {
  const { state, narration, elapsedMs, totalMs, playing, speed, controls } =
    useReplayAuditState({ autoPlay: true, initialSpeed: 16 });

  const variantProps: VariantProps = { state, narration, elapsedMs, totalMs, playing };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
        PROTOTYPE — replaying real run db41a945 (throwaway)
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-2 text-sm">
        <button
          type="button"
          onClick={playing ? controls.pause : controls.play}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100"
        >
          {playing ? 'Pause' : 'Play'}
        </button>

        <input
          type="range"
          min={0}
          max={totalMs}
          value={elapsedMs}
          onChange={(e) => controls.seek(Number(e.target.value))}
          className="h-1 flex-1 min-w-[12rem] cursor-pointer accent-neutral-900"
          aria-label="Scrub replay"
        />

        <span className="tabular-nums text-xs text-neutral-500">
          {fmt(elapsedMs)} / {fmt(totalMs)}
        </span>

        <div className="flex items-center gap-1">
          {controls.speeds.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => controls.setSpeed(s)}
              className={
                s === speed
                  ? 'rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white'
                  : 'rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100'
              }
            >
              {s}x
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={controls.jumpToEnd}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100"
        >
          Jump to end
        </button>
      </div>

      <Suspense fallback={null}>
        <SelectedVariant {...variantProps} />
        <PrototypeSwitcher />
      </Suspense>
    </div>
  );
}
