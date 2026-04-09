'use client';

import { useState } from 'react';
import { Copy, Check, Pencil, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { EvidenceChain } from './evidence-chain';
import type { AdScript } from '@/lib/scripts/schemas';

const TYPE_COLORS: Record<AdScript['type'], string> = {
  video: 'text-blue-500',
  static: 'text-amber-500',
  email: 'text-green-500',
};

const TYPE_BG: Record<AdScript['type'], string> = {
  video: 'bg-blue-500/10',
  static: 'bg-amber-500/10',
  email: 'bg-green-500/10',
};

const PLATFORM_LABELS: Record<AdScript['platform'], string> = {
  meta: 'Meta',
  google: 'Google',
  linkedin: 'LinkedIn',
};

const ANGLE_LABELS: Record<AdScript['angle'], string> = {
  painPoint: 'Pain Point',
  outcome: 'Outcome',
  socialProof: 'Social Proof',
  curiosity: 'Curiosity',
  urgency: 'Urgency',
  identity: 'Identity',
  contrarian: 'Contrarian',
};

const FRAMEWORK_LABELS: Record<string, string> = {
  'talking-head-broll': 'Talking Head',
  'case-study-snapshot': 'Case Study',
  'objection-first': 'Objection-First',
  'qa-style': 'Q&A',
  'demo-screencast': 'Demo',
  'interview': 'Interview',
  'skit-scenario': 'Skit',
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  'in-market': { label: 'In-Market', color: 'text-emerald-500 bg-emerald-500/10' },
  'needs-convinced': { label: 'Needs Convinced', color: 'text-amber-500 bg-amber-500/10' },
  'cold-mass': { label: 'Cold', color: 'text-sky-500 bg-sky-500/10' },
};

interface ScriptItemProps {
  script: AdScript;
  packId: string;
  onUpdate?: (scriptId: string, updates: Partial<AdScript>) => void;
}

export function ScriptItem({ script, packId, onUpdate }: ScriptItemProps) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(script.body);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  function buildCopyText(): string {
    const parts: string[] = [];
    if (script.headline) parts.push(script.headline);
    if (script.subheadline) parts.push(script.subheadline);
    parts.push(script.body);
    if (script.cta) parts.push(`CTA: ${script.cta}`);
    return parts.join('\n\n');
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/scripts/${packId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: script.id, updates: { body: editBody } }),
      });
      if (res.ok) {
        onUpdate?.(script.id, { body: editBody });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRegen() {
    setRegenError(null);
    try {
      const res = await fetch(
        `/api/scripts/${packId}/scripts/${script.id}/regenerate`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!res.ok) {
        setRegenError(data.error ?? 'Regeneration failed');
      }
    } catch {
      setRegenError('Network error');
    }
  }

  return (
    <div className="group rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-5 transition-colors hover:border-[var(--border-hover)]">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type tag */}
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wide',
              TYPE_BG[script.type],
              TYPE_COLORS[script.type],
            )}
          >
            {script.type}
          </span>
          {/* Platform */}
          <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-wide">
            {PLATFORM_LABELS[script.platform]}
          </span>
          {/* Duration */}
          {script.duration && (
            <span className="text-[11px] font-mono text-[var(--text-quaternary)]">
              {script.duration}
            </span>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Copy script"
          >
            {copied ? (
              <Check className="size-3.5 text-[var(--accent-green)]" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
          <button
            onClick={() => {
              setEditBody(script.body);
              setEditing(true);
            }}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Edit script"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={handleRegen}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Regenerate script"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Title */}
      {script.title && (
        <h3 className="text-[15px] font-semibold font-heading text-[var(--text-primary)] mb-2 leading-snug">
          {script.title}
        </h3>
      )}

      {/* Meta row: confidence + humanized + angle */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
          Confidence{' '}
          <span className="text-[var(--text-primary)] tabular-nums">{script.confidenceScore}/10</span>
        </span>
        {script.humanizedPass && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--accent-green)]/10 text-[var(--accent-green)] text-[10px] font-mono font-medium uppercase tracking-wide">
            Humanized
          </span>
        )}
        {script.angle && (
          <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
            {ANGLE_LABELS[script.angle]}
          </span>
        )}
        {/* V2: Framework badge */}
        {script.framework && FRAMEWORK_LABELS[script.framework] && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[10px] font-mono font-medium text-[var(--text-tertiary)] uppercase tracking-wide border border-[var(--border-default)]">
            {FRAMEWORK_LABELS[script.framework]}
          </span>
        )}
        {/* V2: In-market tier */}
        {script.inMarketTier && TIER_LABELS[script.inMarketTier] && (
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wide',
            TIER_LABELS[script.inMarketTier].color,
          )}>
            {TIER_LABELS[script.inMarketTier].label}
          </span>
        )}
      </div>

      {/* Headline + Subheadline */}
      {script.headline && (
        <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{script.headline}</p>
      )}
      {script.subheadline && (
        <p className="text-sm text-[var(--text-secondary)] mb-3">{script.subheadline}</p>
      )}

      {/* Body */}
      {editing ? (
        <div className="space-y-2 mb-3">
          <Textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={8}
            className="text-sm text-[var(--text-primary)] bg-[var(--bg-base)] border-[var(--border-default)] resize-none"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              className="text-xs px-3 py-1.5 rounded-md text-[var(--text-tertiary)]"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed mb-3">
          {script.body}
        </p>
      )}

      {/* CTA */}
      {script.cta && (
        <p className="text-sm font-medium text-[var(--accent-blue)] mb-3">{script.cta}</p>
      )}

      {/* Hook variants (video) */}
      {script.type === 'video' && script.hookVariants && script.hookVariants.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--text-tertiary)] mb-2">
            Hook Variants
          </p>
          <ul className="space-y-1.5">
            {script.hookVariants.map((hook, i) => (
              <li
                key={i}
                className="border-l-2 border-[var(--accent-blue)]/30 pl-3 text-sm text-[var(--text-secondary)] leading-relaxed"
              >
                {hook}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Design direction (static) */}
      {script.type === 'static' && script.designDirection && (
        <div className="mb-3 rounded-md bg-[var(--bg-base)] px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--text-tertiary)] mb-1">
            Design Direction
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{script.designDirection}</p>
        </div>
      )}

      {/* Evidence chain */}
      {script.groundedIn && script.groundedIn.length > 0 && (
        <div className="mb-3">
          <EvidenceChain groundedIn={script.groundedIn} />
        </div>
      )}

      {/* Flagged claims */}
      {script.flaggedClaims && script.flaggedClaims.length > 0 && (
        <div className="rounded-md border border-[var(--accent-amber)]/20 bg-[var(--accent-amber)]/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="size-3.5 text-[var(--accent-amber)]" />
            <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--accent-amber)]">
              Review before use
            </p>
          </div>
          <ul className="space-y-1">
            {script.flaggedClaims.map((claim, i) => (
              <li key={i} className="text-xs text-[var(--text-secondary)]">
                {typeof claim === 'string' ? claim : `${claim.claim} — ${claim.reason}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Regen error */}
      {regenError && (
        <p className="text-xs text-[var(--accent-amber)] mt-2 font-mono">
          {regenError}
        </p>
      )}
    </div>
  );
}
