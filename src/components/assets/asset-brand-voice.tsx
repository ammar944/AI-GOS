'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { BrandVoiceNotes } from '@/lib/profiles/business-profiles';

interface AssetBrandVoiceProps {
  value: BrandVoiceNotes | null;
  onChange: (notes: BrandVoiceNotes) => void;
  disabled?: boolean;
}

const LIMITS = { tone: 500, constraints: 1000, goodExample: 1500, badExample: 1500 } as const;

const DEFAULT: BrandVoiceNotes = { tone: '', constraints: '', goodExample: '', badExample: '' };

export function AssetBrandVoice({ value, onChange, disabled }: AssetBrandVoiceProps) {
  const [notes, setNotes] = useState<BrandVoiceNotes>(value ?? DEFAULT);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (value) setNotes(value);
  }, [value]);

  const handleChange = useCallback(
    (field: keyof BrandVoiceNotes, val: string) => {
      const limit = LIMITS[field];
      const trimmed = val.slice(0, limit);
      const updated = { ...notes, [field]: trimmed };
      setNotes(updated);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(updated), 500);
    },
    [notes, onChange],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Guidance */}
      <div className="flex gap-3 items-start rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
        <span className="text-lg flex-shrink-0">🎙️</span>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Define your brand&apos;s voice. These notes become{' '}
          <strong className="text-[var(--text-primary)]">hard constraints</strong> for the script
          generator — it will follow them in every script across all awareness levels.
        </p>
      </div>

      {/* Tone */}
      <div>
        <label className="block text-xs uppercase tracking-widest text-[var(--text-muted)] font-mono mb-2">
          Tone & Personality
        </label>
        <textarea
          value={notes.tone}
          onChange={(e) => handleChange('tone', e.target.value)}
          disabled={disabled}
          placeholder="e.g. Authoritative but approachable. Like talking to a smart friend who's spent $10M on ads."
          rows={3}
          className={cn(
            'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5',
            'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
          )}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[11px] text-[var(--text-muted)]">Describe the personality and tone your ads should have</span>
          <span className="text-[11px] text-[var(--text-muted)]">{notes.tone.length}/{LIMITS.tone}</span>
        </div>
      </div>

      {/* Constraints */}
      <div>
        <label className="block text-xs uppercase tracking-widest text-[var(--text-muted)] font-mono mb-2">
          Hard Rules & Constraints
        </label>
        <textarea
          value={notes.constraints}
          onChange={(e) => handleChange('constraints', e.target.value)}
          disabled={disabled}
          placeholder="e.g. Never use exclamation marks. No emojis. Always lead with a data point. Use 'you' not 'we'."
          rows={3}
          className={cn(
            'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5',
            'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
          )}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[11px] text-[var(--text-muted)]">Things the AI should never do or always do</span>
          <span className="text-[11px] text-[var(--text-muted)]">{notes.constraints.length}/{LIMITS.constraints}</span>
        </div>
      </div>

      {/* Good vs Bad Examples */}
      <div>
        <label className="block text-xs uppercase tracking-widest text-[var(--text-muted)] font-mono mb-2">
          Good vs Bad Examples
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-green-900/30 bg-green-950/20 p-3.5">
            <div className="text-[11px] uppercase tracking-widest text-green-400 mb-2">✓ Good</div>
            <textarea
              value={notes.goodExample}
              onChange={(e) => handleChange('goodExample', e.target.value)}
              disabled={disabled}
              placeholder="Paste an example of copy that sounds like your brand"
              rows={4}
              className={cn(
                'w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                'resize-none focus:outline-none border-none p-0',
              )}
            />
            <div className="text-right text-[11px] text-[var(--text-muted)]">{notes.goodExample.length}/{LIMITS.goodExample}</div>
          </div>
          <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-3.5">
            <div className="text-[11px] uppercase tracking-widest text-red-400 mb-2">✗ Bad</div>
            <textarea
              value={notes.badExample}
              onChange={(e) => handleChange('badExample', e.target.value)}
              disabled={disabled}
              placeholder="Paste an example of what your brand should never sound like"
              rows={4}
              className={cn(
                'w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                'resize-none focus:outline-none border-none p-0',
              )}
            />
            <div className="text-right text-[11px] text-[var(--text-muted)]">{notes.badExample.length}/{LIMITS.badExample}</div>
          </div>
        </div>
        <span className="text-[11px] text-[var(--text-muted)] mt-1 block">Show the AI what your brand sounds like vs what it should avoid</span>
      </div>
    </div>
  );
}
