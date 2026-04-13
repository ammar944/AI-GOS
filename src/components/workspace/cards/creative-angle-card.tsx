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
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-hover)]/40 px-3 py-2.5">
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">
            Target segment
          </span>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)] normal-case tracking-normal">
            {targetSegment.trim()}
          </p>
        </div>
      ) : null}
      {hook?.trim() ? (
        <blockquote className="border-l-2 border-[var(--accent-blue)]/50 pl-3">
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
                <p className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">
                  {block.heading}
                </p>
              ) : null}
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{block.body}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
