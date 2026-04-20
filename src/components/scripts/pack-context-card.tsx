'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { GenerationContext } from '@/lib/scripts/schemas';

interface PackContextCardProps {
  context: GenerationContext | null;
}

export function PackContextCard({ context }: PackContextCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!context) return null;

  const date = (() => {
    try {
      return new Date(context.researchSessionDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Unknown date';
    }
  })();

  const refCount = context.styleReferencesUsed?.length ?? 0;
  const proofCount = context.proofPointsUsed?.length ?? 0;
  const userNote = context.userNote;

  const summaryParts: string[] = [
    `Generated ${date}`,
    `${refCount} ref${refCount !== 1 ? 's' : ''}`,
    `${proofCount} proof${proofCount !== 1 ? 's' : ''}`,
  ];
  if (userNote) {
    summaryParts.push(`'${userNote}'`);
  }
  const summaryLine = summaryParts.join(' · ');

  const panelId = 'pack-context-expanded';

  return (
    <div
      className="border-l-2 pl-3 py-1"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <p
        className="text-[12px] leading-snug"
        style={{ fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)', color: 'var(--text-secondary)' }}
      >
        {summaryLine}
      </p>

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'mt-1 text-[11px] font-mono cursor-pointer select-none transition-colors duration-100',
          'hover:text-[var(--text-tertiary)]',
        )}
        style={{ color: 'var(--text-quaternary)', fontFamily: '"JetBrains Mono", monospace' }}
      >
        {expanded ? '▾ Collapse' : '▸ Expand'}
      </button>

      {expanded && (
        <div
          id={panelId}
          className="mt-3 space-y-3"
        >
          {/* Research session */}
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.06em] mb-1"
              style={{ fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-quaternary)', fontWeight: 500 }}
            >
              Research Session
            </p>
            <p
              className="text-[13px]"
              style={{ fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)', color: 'var(--text-secondary)' }}
            >
              {date} · {context.researchSectionCount} section{context.researchSectionCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Style references */}
          {refCount > 0 && (
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.06em] mb-1"
                style={{ fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-quaternary)', fontWeight: 500 }}
              >
                Style References ({refCount})
              </p>
              <ul className="space-y-0.5">
                {context.styleReferencesUsed.map((ref, i) => (
                  <li
                    key={i}
                    className="text-[13px]"
                    style={{ fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)', color: 'var(--text-secondary)' }}
                  >
                    {ref.name}
                    {ref.source && (
                      <span
                        className="ml-1 text-[12px]"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        — {ref.source}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Proof points */}
          {proofCount > 0 && (
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.06em] mb-1"
                style={{ fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-quaternary)', fontWeight: 500 }}
              >
                Proof Points ({proofCount})
              </p>
              <ul className="space-y-0.5">
                {context.proofPointsUsed.map((proof, i) => (
                  <li
                    key={i}
                    className="text-[13px]"
                    style={{ fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)', color: 'var(--text-secondary)' }}
                  >
                    {proof.headline}
                    {proof.type && (
                      <span
                        className="ml-1 text-[12px]"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        · {proof.type}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* User note */}
          {userNote && (
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.06em] mb-1"
                style={{ fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-quaternary)', fontWeight: 500 }}
              >
                Note
              </p>
              <p
                className="text-[13px]"
                style={{ fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)', color: 'var(--text-secondary)' }}
              >
                {userNote}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
