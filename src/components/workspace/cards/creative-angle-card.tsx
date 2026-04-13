'use client';

import { messagingApproachToBlocks } from '@/lib/workspace/messaging-approach-blocks';

interface CreativeAngleCardProps {
  /** Shown in parent ArtifactCard / document header only — not duplicated here */
  theme?: string;
  hook?: string;
  messagingApproach?: string;
  targetSegment?: string;
}

export function CreativeAngleCard({ hook, messagingApproach, targetSegment }: CreativeAngleCardProps) {
  const blocks = messagingApproach ? messagingApproachToBlocks(messagingApproach) : [];

  return (
    <div className="space-y-4">
      {targetSegment?.trim() ? (
        <div className="border-l-2 border-[var(--accent-blue)] pl-3 py-0.5">
          <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] block mb-1">
            Target segment
          </span>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {targetSegment.trim()}
          </p>
        </div>
      ) : null}
      {hook?.trim() ? (
        <blockquote className="border-l-2 border-[var(--accent-blue)] pl-3">
          <p className="text-sm italic leading-relaxed text-[var(--text-secondary)]">
            &ldquo;{hook.trim()}&rdquo;
          </p>
        </blockquote>
      ) : null}
      {blocks.length > 0 ? (
        <div className="space-y-3">
          {blocks.map((block, i) => (
            <div key={i} className="space-y-1">
              {block.heading ? (
                <span className="inline-block text-[10px] font-mono font-medium uppercase tracking-[0.06em] rounded-full px-2 py-0.5 tabular-nums"
                  style={{
                    color: 'var(--accent-blue)',
                    background: 'var(--accent-blue-subtle)',
                  }}
                >
                  {block.heading}
                </span>
              ) : null}
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{block.body}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
