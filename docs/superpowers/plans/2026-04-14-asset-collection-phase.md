# Asset Collection Phase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert an optional asset collection phase between media plan and script generation in the journey flow, allowing users to add style references, proof points, and brand voice notes that improve script quality.

**Architecture:** New `AssetCollectionPhase` component replaces artifact canvas (same swap pattern as `ScriptsPhaseContent`). Three shared sub-components (`AssetStyleRefs`, `AssetProofPoints`, `AssetBrandVoice`) are used in both the journey workspace and the profile page. Brand voice notes are a new Supabase column + TypeScript type. The script runner's Pass 1 and Pass 2 prompts get three new injection blocks.

**Tech Stack:** Next.js 15, React, Supabase (JSONB columns), Clerk auth, Railway worker (Express), Anthropic Claude prompts

**Spec:** `docs/superpowers/specs/2026-04-14-asset-collection-phase-design.md`

---

## Task 1: Data Model — BrandVoiceNotes Type + Supabase Migration

**Files:**
- Modify: `src/lib/profiles/business-profiles.ts:40-53` (add interface), `:429-460` (update mapRow)
- Create: Supabase migration via dashboard or SQL

- [ ] **Step 1: Add BrandVoiceNotes interface**

In `src/lib/profiles/business-profiles.ts`, after the `ProofPoint` interface (line 53), add:

```typescript
export interface BrandVoiceNotes {
  tone: string;
  constraints: string;
  goodExample: string;
  badExample: string;
}
```

- [ ] **Step 2: Add brandVoiceNotes to BusinessProfile interface**

Find the `BusinessProfile` interface (starts ~line 55). After the `proofPoints` field, add:

```typescript
brandVoiceNotes: BrandVoiceNotes | null;
```

- [ ] **Step 3: Update mapRow**

In the `mapRow` function (~line 429), after the `proofPoints` mapping line, add:

```typescript
brandVoiceNotes: (row.brand_voice_notes as BrandVoiceNotes) ?? null,
```

- [ ] **Step 4: Run Supabase migration**

Apply via Supabase dashboard SQL editor:

```sql
ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS brand_voice_notes JSONB DEFAULT NULL;

COMMENT ON COLUMN business_profiles.brand_voice_notes IS 'Structured brand voice: tone, constraints, goodExample, badExample';
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: passes with no errors related to brandVoiceNotes (existing code doesn't reference it yet).

- [ ] **Step 6: Commit**

```bash
git add src/lib/profiles/business-profiles.ts
git commit -m "feat(assets): add BrandVoiceNotes type and Supabase column"
```

---

## Task 2: API — Extend Style References Endpoint for Brand Voice

**Files:**
- Modify: `src/app/api/profiles/[id]/style-references/route.ts:5-46`

- [ ] **Step 1: Add brandVoiceNotes to request body destructuring**

In the PUT handler, find the destructuring (~line 23):

```typescript
const { styleReferences, proofPoints } = body as {
  styleReferences?: unknown;
  proofPoints?: unknown;
};
```

Change to:

```typescript
const { styleReferences, proofPoints, brandVoiceNotes } = body as {
  styleReferences?: unknown;
  proofPoints?: unknown;
  brandVoiceNotes?: unknown;
};
```

- [ ] **Step 2: Add validation and update logic for brandVoiceNotes**

After the `proofPoints` validation block, add:

```typescript
if (brandVoiceNotes !== undefined) {
  if (brandVoiceNotes !== null && typeof brandVoiceNotes !== 'object') {
    return NextResponse.json({ error: 'brandVoiceNotes must be an object or null' }, { status: 400 });
  }
  if (brandVoiceNotes !== null) {
    const bvn = brandVoiceNotes as Record<string, unknown>;
    if (typeof bvn.tone !== 'string' || typeof bvn.constraints !== 'string' ||
        typeof bvn.goodExample !== 'string' || typeof bvn.badExample !== 'string') {
      return NextResponse.json({ error: 'brandVoiceNotes requires tone, constraints, goodExample, badExample strings' }, { status: 400 });
    }
    // Token budget caps
    if ((bvn.tone as string).length > 500) return NextResponse.json({ error: 'tone exceeds 500 char limit' }, { status: 400 });
    if ((bvn.constraints as string).length > 1000) return NextResponse.json({ error: 'constraints exceeds 1000 char limit' }, { status: 400 });
    if ((bvn.goodExample as string).length > 1500) return NextResponse.json({ error: 'goodExample exceeds 1500 char limit' }, { status: 400 });
    if ((bvn.badExample as string).length > 1500) return NextResponse.json({ error: 'badExample exceeds 1500 char limit' }, { status: 400 });
  }
  update.brand_voice_notes = brandVoiceNotes;
}
```

- [ ] **Step 3: Update response to include brandVoiceNotes**

In the success response, add `brandVoiceNotes` to the returned object (read back from the updated row or echo the input).

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/profiles/[id]/style-references/route.ts
git commit -m "feat(assets): extend style-references API for brandVoiceNotes with validation"
```

---

## Task 3: Shared Component — AssetBrandVoice

**Files:**
- Create: `src/components/assets/asset-brand-voice.tsx`

- [ ] **Step 1: Create the component**

```typescript
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

  // Sync external value changes
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

  // Expose flush for parent to cancel debounce and save immediately
  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    onChange(notes);
  }, [notes, onChange]);

  // Attach flush to ref so parent can call it
  useEffect(() => {
    (handleChange as unknown as Record<string, unknown>).flush = flush;
  }, [flush, handleChange]);

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
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/assets/asset-brand-voice.tsx
git commit -m "feat(assets): add AssetBrandVoice component with structured fields"
```

---

## Task 4: Shared Component — AssetStyleRefs

**Files:**
- Create: `src/components/assets/asset-style-refs.tsx`

- [ ] **Step 1: Create the component**

Extracted and improved version of the style refs section from `StyleRefsTab`. Key improvements: inline edit, content length cap (5000 chars), contextual guidance tip.

```typescript
'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { StyleReference } from '@/lib/profiles/business-profiles';

interface AssetStyleRefsProps {
  refs: StyleReference[];
  onChange: (refs: StyleReference[]) => void;
  disabled?: boolean;
}

const MAX_CONTENT_LENGTH = 5000;

export function AssetStyleRefs({ refs, onChange, disabled }: AssetStyleRefsProps) {
  const [adding, setAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [form, setForm] = useState<StyleReference>({ name: '', content: '', source: '' });

  const handleSave = useCallback(() => {
    const trimmed: StyleReference = {
      name: form.name.trim(),
      content: form.content.trim().slice(0, MAX_CONTENT_LENGTH),
      source: form.source.trim(),
    };
    if (!trimmed.name || !trimmed.content) return;

    if (editingIdx !== null) {
      const updated = [...refs];
      updated[editingIdx] = trimmed;
      onChange(updated);
      setEditingIdx(null);
    } else {
      onChange([...refs, trimmed]);
    }
    setForm({ name: '', content: '', source: '' });
    setAdding(false);
  }, [form, refs, onChange, editingIdx]);

  const handleEdit = useCallback((idx: number) => {
    setForm(refs[idx]);
    setEditingIdx(idx);
    setAdding(true);
  }, [refs]);

  const handleDelete = useCallback((idx: number) => {
    onChange(refs.filter((_, i) => i !== idx));
  }, [refs, onChange]);

  const handleCancel = useCallback(() => {
    setForm({ name: '', content: '', source: '' });
    setAdding(false);
    setEditingIdx(null);
  }, []);

  return (
    <div>
      {/* Guidance */}
      <div className="flex gap-3 items-start rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 mb-6">
        <span className="text-lg flex-shrink-0">💡</span>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Paste your winning ads, VSLs, or competitor copy here. The AI studies their{' '}
          <strong className="text-[var(--text-primary)]">voice, cadence, and structure</strong> —
          then generates scripts that match that register. It mirrors the pattern, not the words.
        </p>
      </div>

      {/* Add/Edit form */}
      {adding && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 mb-4">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name (e.g. Winning VSL — Feb 2024)"
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 mb-3',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="Source URL (optional)"
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 mb-3',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value.slice(0, MAX_CONTENT_LENGTH) })}
            placeholder="Paste the ad copy, script, or hook text here"
            rows={6}
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-[11px] text-[var(--text-muted)]">{form.content.length}/{MAX_CONTENT_LENGTH}</span>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.content.trim()}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  'bg-[var(--accent-blue)] text-white',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {editingIdx !== null ? 'Save Changes' : 'Add Reference'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Add new card */}
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            disabled={disabled}
            className={cn(
              'border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8',
              'flex flex-col items-center justify-center cursor-pointer min-h-[180px]',
              'hover:border-[var(--accent-blue)] transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center mb-3">
              <span className="text-[var(--accent-blue)] text-xl">+</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-muted)]">Add Reference Ad</span>
            <span className="text-xs text-[var(--text-muted)] mt-1">Paste winning copy or ad scripts</span>
          </button>
        )}

        {/* Existing cards */}
        {refs.map((ref, idx) => (
          <div
            key={`${ref.name}-${idx}`}
            className="border border-[var(--border-subtle)] rounded-xl p-5 bg-[var(--bg-surface)] min-h-[180px] relative"
          >
            <div className="flex justify-between items-start mb-2.5">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">{ref.name}</div>
                {ref.source && (
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{ref.source}</div>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleEdit(idx)}
                  className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(idx)}
                  className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] line-clamp-5">
              {ref.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/assets/asset-style-refs.tsx
git commit -m "feat(assets): add AssetStyleRefs component with add/edit/delete"
```

---

## Task 5: Shared Component — AssetProofPoints

**Files:**
- Create: `src/components/assets/asset-proof-points.tsx`

- [ ] **Step 1: Create the component**

Extracted and improved from StyleRefsTab's proof points section. Key improvements: inline edit, type badge colors, verified toggle.

```typescript
'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ProofPoint } from '@/lib/profiles/business-profiles';

interface AssetProofPointsProps {
  points: ProofPoint[];
  onChange: (points: ProofPoint[]) => void;
  disabled?: boolean;
}

const PROOF_TYPES = ['case_study', 'testimonial', 'metric', 'credential'] as const;

const TYPE_LABELS: Record<string, string> = {
  case_study: 'Case Study',
  testimonial: 'Testimonial',
  metric: 'Metric',
  credential: 'Credential',
};

const TYPE_COLORS: Record<string, string> = {
  case_study: 'bg-blue-950/30 text-blue-400 border-blue-900/30',
  testimonial: 'bg-purple-950/30 text-purple-400 border-purple-900/30',
  metric: 'bg-green-950/30 text-green-400 border-green-900/30',
  credential: 'bg-amber-950/30 text-amber-400 border-amber-900/30',
};

type ProofForm = Omit<ProofPoint, 'id'>;

const DEFAULT_FORM: ProofForm = {
  type: 'metric',
  headline: '',
  detail: '',
  clientName: undefined,
  verified: false,
};

export function AssetProofPoints({ points, onChange, disabled }: AssetProofPointsProps) {
  const [adding, setAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [form, setForm] = useState<ProofForm>(DEFAULT_FORM);

  const handleSave = useCallback(() => {
    if (!form.headline.trim() || !form.detail.trim()) return;

    const entry: ProofPoint = {
      ...form,
      id: editingIdx !== null ? points[editingIdx].id : crypto.randomUUID(),
      headline: form.headline.trim(),
      detail: form.detail.trim(),
      clientName: form.clientName?.trim() || undefined,
    };

    if (editingIdx !== null) {
      const updated = [...points];
      updated[editingIdx] = entry;
      onChange(updated);
      setEditingIdx(null);
    } else {
      onChange([...points, entry]);
    }
    setForm(DEFAULT_FORM);
    setAdding(false);
  }, [form, points, onChange, editingIdx]);

  const handleEdit = useCallback((idx: number) => {
    const p = points[idx];
    setForm({ type: p.type, headline: p.headline, detail: p.detail, clientName: p.clientName, verified: p.verified });
    setEditingIdx(idx);
    setAdding(true);
  }, [points]);

  const handleDelete = useCallback((idx: number) => {
    onChange(points.filter((_, i) => i !== idx));
  }, [points, onChange]);

  const toggleVerified = useCallback((idx: number) => {
    const updated = [...points];
    updated[idx] = { ...updated[idx], verified: !updated[idx].verified };
    onChange(updated);
  }, [points, onChange]);

  const handleCancel = useCallback(() => {
    setForm(DEFAULT_FORM);
    setAdding(false);
    setEditingIdx(null);
  }, []);

  return (
    <div>
      {/* Guidance */}
      <div className="flex gap-3 items-start rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 mb-6">
        <span className="text-lg flex-shrink-0">🛡️</span>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Add real case studies, testimonials, and metrics. The AI{' '}
          <strong className="text-[var(--text-primary)]">cites these instead of fabricating claims</strong>.
          Proof points rotate across awareness levels so scripts don&apos;t repeat the same evidence.
        </p>
      </div>

      {/* Add/Edit form */}
      {adding && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 mb-4">
          <div className="flex gap-3 mb-3">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ProofPoint['type'] })}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              {PROOF_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.verified}
                onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                className="rounded"
              />
              Verified
            </label>
          </div>
          <input
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
            placeholder="Headline (e.g. 3 demos to 22 in 90 days)"
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 mb-3',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <input
            value={form.clientName ?? ''}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            placeholder="Client name (optional)"
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 mb-3',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <textarea
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
            placeholder="Full details — the AI uses this as source material"
            rows={4}
            className={cn(
              'w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
            )}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={handleCancel} className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!form.headline.trim() || !form.detail.trim()}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-[var(--accent-blue)] text-white disabled:opacity-40"
            >
              {editingIdx !== null ? 'Save Changes' : 'Add Proof Point'}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            disabled={disabled}
            className={cn(
              'border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8',
              'flex flex-col items-center justify-center cursor-pointer min-h-[160px]',
              'hover:border-[var(--accent-blue)] transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center mb-3">
              <span className="text-[var(--accent-blue)] text-xl">+</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-muted)]">Add Proof Point</span>
            <span className="text-xs text-[var(--text-muted)] mt-1">Case study, testimonial, metric, or credential</span>
          </button>
        )}

        {points.map((p, idx) => (
          <div key={p.id} className="border border-[var(--border-subtle)] rounded-xl p-5 bg-[var(--bg-surface)] min-h-[160px]">
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2 items-center">
                <span className={cn('text-[11px] px-2 py-0.5 rounded border', TYPE_COLORS[p.type] ?? TYPE_COLORS.metric)}>
                  {TYPE_LABELS[p.type] ?? p.type}
                </span>
                {p.verified && <span className="text-green-400 text-[13px]">✓ verified</span>}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => toggleVerified(idx)} className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-green-400">🛡️</button>
                <button onClick={() => handleEdit(idx)} className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">✏️</button>
                <button onClick={() => handleDelete(idx)} className="w-7 h-7 rounded-md bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-red-400">🗑</button>
              </div>
            </div>
            <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{p.headline}</div>
            {p.clientName && <div className="text-xs text-[var(--text-muted)] mb-2">{p.clientName}</div>}
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] line-clamp-3">{p.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/assets/asset-proof-points.tsx
git commit -m "feat(assets): add AssetProofPoints component with type badges and verified toggle"
```

---

## Task 6: AssetCollectionPhase — Main Workspace Component

**Files:**
- Create: `src/components/workspace/asset-collection-phase.tsx`

- [ ] **Step 1: Create the component**

This is the main phase view. Fetches profile data on mount (same pattern as `ScriptsPhaseContent` at `scripts-phase.tsx:48-92`), manages tabs, auto-saves with debounce, and has flush-on-generate logic per Fix 2.

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AssetStyleRefs } from '@/components/assets/asset-style-refs';
import { AssetProofPoints } from '@/components/assets/asset-proof-points';
import { AssetBrandVoice } from '@/components/assets/asset-brand-voice';
import type { StyleReference, ProofPoint, BrandVoiceNotes } from '@/lib/profiles/business-profiles';

interface AssetCollectionPhaseProps {
  runId: string;
  onGenerateScripts: () => void;
  onSkip: () => void;
}

type Tab = 'style-refs' | 'proof-points' | 'voice';

const TABS: { id: Tab; label: string }[] = [
  { id: 'style-refs', label: 'Style References' },
  { id: 'proof-points', label: 'Proof Points' },
  { id: 'voice', label: 'Brand Voice' },
];

export function AssetCollectionPhase({ runId, onGenerateScripts, onSkip }: AssetCollectionPhaseProps) {
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('style-refs');
  const [styleRefs, setStyleRefs] = useState<StyleReference[]>([]);
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>([]);
  const [brandVoice, setBrandVoice] = useState<BrandVoiceNotes | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const fetchedRef = useRef(false);

  // Fetch profile data on mount — same pattern as ScriptsPhaseContent
  useEffect(() => {
    if (!runId || fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/journey/session?runId=${runId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const pid: string | null = data.profileId ?? null;
        setProfileId(pid);

        if (pid) {
          const profileRes = await fetch(`/api/profiles/${pid}`, { credentials: 'same-origin' });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            setStyleRefs(profile.styleReferences ?? []);
            setProofPoints(profile.proofPoints ?? []);
            setBrandVoice(profile.brandVoiceNotes ?? null);
          }
        }
      } catch {
        // Fall through — empty state is fine
      } finally {
        setLoading(false);
      }
    })();
  }, [runId]);

  // Persist to Supabase via API
  const persistAssets = useCallback(async (
    refs: StyleReference[],
    points: ProofPoint[],
    voice: BrandVoiceNotes | null,
  ) => {
    if (!profileId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/style-references`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          styleReferences: refs,
          proofPoints: points,
          brandVoiceNotes: voice,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        setSaveError(err.error ?? 'Save failed');
      }
    } catch {
      setSaveError('Network error — changes not saved');
    } finally {
      setSaving(false);
    }
  }, [profileId]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback((
    refs: StyleReference[],
    points: ProofPoint[],
    voice: BrandVoiceNotes | null,
  ) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistAssets(refs, points, voice), 500);
  }, [persistAssets]);

  // Handlers that update state + trigger auto-save
  const handleStyleRefsChange = useCallback((refs: StyleReference[]) => {
    setStyleRefs(refs);
    scheduleAutoSave(refs, proofPoints, brandVoice);
  }, [proofPoints, brandVoice, scheduleAutoSave]);

  const handleProofPointsChange = useCallback((points: ProofPoint[]) => {
    setProofPoints(points);
    scheduleAutoSave(styleRefs, points, brandVoice);
  }, [styleRefs, brandVoice, scheduleAutoSave]);

  const handleBrandVoiceChange = useCallback((voice: BrandVoiceNotes) => {
    setBrandVoice(voice);
    scheduleAutoSave(styleRefs, proofPoints, voice);
  }, [styleRefs, proofPoints, scheduleAutoSave]);

  // Flush-save then generate (Fix 2: race condition prevention)
  const handleGenerateScripts = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
    setGenerating(true);
    await persistAssets(styleRefs, proofPoints, brandVoice);
    if (saveError) {
      setGenerating(false);
      return; // Don't navigate if save failed
    }
    onGenerateScripts();
  }, [styleRefs, proofPoints, brandVoice, persistAssets, saveError, onGenerateScripts]);

  const totalAssets = styleRefs.length + proofPoints.length + (brandVoice && (brandVoice.tone || brandVoice.constraints) ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] px-8 pt-8 pb-0">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] uppercase tracking-[1.5px] text-[var(--accent-blue)] font-mono mb-2">Optional Step</div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1.5">Enhance Your Ad Scripts</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-[500px]">
              Add reference materials, proof points, and voice guidelines to make your scripts match your brand.
              You can always add these later from your profile.
            </p>
          </div>
          <div className="flex gap-2.5 items-center pt-1">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-md hover:text-[var(--text-primary)] transition-colors"
            >
              Skip to Scripts
            </button>
            <button
              onClick={handleGenerateScripts}
              disabled={generating}
              className={cn(
                'px-5 py-2 rounded-md text-sm font-medium transition-colors',
                'bg-[var(--accent-blue)] text-white',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {generating ? 'Saving...' : 'Generate Scripts →'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-2.5 text-[13px] font-medium transition-colors border-b-2',
                activeTab === tab.id
                  ? 'text-[var(--text-primary)] border-[var(--accent-blue)]'
                  : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-8 py-6 flex-1">
        {activeTab === 'style-refs' && (
          <AssetStyleRefs refs={styleRefs} onChange={handleStyleRefsChange} />
        )}
        {activeTab === 'proof-points' && (
          <AssetProofPoints points={proofPoints} onChange={handleProofPointsChange} />
        )}
        {activeTab === 'voice' && (
          <AssetBrandVoice value={brandVoice} onChange={handleBrandVoiceChange} />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border-subtle)] px-8 py-4 flex justify-between items-center">
        <div className="flex gap-4">
          <span className="text-xs text-[var(--text-muted)]">
            <span className={cn('font-semibold', styleRefs.length > 0 ? 'text-[var(--accent-blue)]' : '')}>{styleRefs.length}</span> style refs
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            <span className={cn('font-semibold', proofPoints.length > 0 ? 'text-[var(--accent-blue)]' : '')}>{proofPoints.length}</span> proof points
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            <span className={cn('font-semibold', brandVoice?.tone ? 'text-[var(--accent-blue)]' : '')}>{brandVoice?.tone ? '1' : '0'}</span> voice notes
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saveError && <span className="text-xs text-red-400">{saveError}</span>}
          {saving && <span className="text-xs text-[var(--text-muted)]">Saving...</span>}
          {!saving && !saveError && totalAssets > 0 && <span className="text-xs text-[var(--text-muted)]">Auto-saved to profile</span>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/asset-collection-phase.tsx
git commit -m "feat(assets): add AssetCollectionPhase workspace component with auto-save"
```

---

## Task 7: Workspace Integration — State Machine + CTA

**Files:**
- Modify: `src/components/workspace/workspace-page.tsx:351-375`
- Modify: `src/components/workspace/artifact-canvas.tsx:263-271`

- [ ] **Step 1: Add asset collection state to workspace-page.tsx**

Find the state declarations near the top of the component. Add after `autoGenerateScripts` state:

```typescript
const [showAssetCollection, setShowAssetCollection] = useState(false);
```

- [ ] **Step 2: Add handleNavigateToAssets handler**

Add before `handleNavigateToScripts` (~line 351):

```typescript
const handleNavigateToAssets = useCallback(() => {
  if (state.sectionStates.mediaPlan === 'review') {
    setSectionPhase('mediaPlan', 'approved');
  }
  setShowAssetCollection(true);
}, [setSectionPhase, state.sectionStates.mediaPlan]);
```

- [ ] **Step 3: Update handleNavigateToScripts to clear asset collection**

Update the existing `handleNavigateToScripts` to also clear asset state:

```typescript
const handleNavigateToScripts = useCallback(() => {
  if (state.sectionStates.mediaPlan === 'review') {
    setSectionPhase('mediaPlan', 'approved');
  }
  setShowAssetCollection(false);
  setSectionPhase('scripts', 'review');
  setAutoGenerateScripts(true);
  navigateToSection('scripts');
}, [setSectionPhase, navigateToSection, state.sectionStates.mediaPlan]);
```

- [ ] **Step 4: Add conditional render for AssetCollectionPhase**

Find where `ScriptsPhaseContent` is rendered (~line 368). BEFORE the scripts check, add asset collection:

```typescript
{showAssetCollection && state.currentSection !== 'scripts' ? (
  <div className="flex flex-1 flex-col min-h-0 overflow-y-auto custom-scrollbar">
    <AssetCollectionPhase
      runId={activeRunId ?? ''}
      onGenerateScripts={handleNavigateToScripts}
      onSkip={handleNavigateToScripts}
    />
  </div>
) : state.currentSection === 'scripts' ? (
  <div className="flex flex-1 flex-col min-h-0 overflow-y-auto custom-scrollbar">
    <ScriptsPhaseContent
      activeRunId={activeRunId ?? null}
      onScriptsGeneratingChange={setScriptsGenerating}
      autoGenerate={autoGenerateScripts}
    />
  </div>
) : (
```

Add the import at the top of the file:

```typescript
import { AssetCollectionPhase } from '@/components/workspace/asset-collection-phase';
```

- [ ] **Step 5: Update artifact-canvas.tsx CTA**

Find the scripts PhaseTransitionCard (~line 263):

```typescript
{mediaPlanComplete && !scriptsActive && state.currentSection !== 'scripts' && onNavigateToScripts && (
  <PhaseTransitionCard
    tag="Next Phase"
    title="Generate your ad scripts"
    description="15 scripts across 5 awareness levels, grounded in your research and media plan."
    actionLabel="Generate Scripts"
    onAction={onNavigateToScripts}
  />
)}
```

Replace with a two-button CTA. First, add `onNavigateToAssets` to the component props interface:

```typescript
onNavigateToAssets?: () => void;
```

Then replace the PhaseTransitionCard block:

```typescript
{mediaPlanComplete && !scriptsActive && state.currentSection !== 'scripts' && (
  <div className={cn(
    'rounded-lg border-l-2 border-l-[var(--accent-blue)]',
    'border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5',
  )}>
    <div className="flex justify-between items-center">
      <div>
        <div className="text-[11px] uppercase tracking-[1.5px] text-[var(--accent-blue)] font-mono mb-1">Next Phase</div>
        <div className="text-sm font-medium text-[var(--text-primary)]">Enhance & generate your ad scripts</div>
        <div className="text-xs text-[var(--text-secondary)] mt-1">Add reference ads, proof points, and voice guidelines — or skip straight to generation.</div>
      </div>
      <div className="flex gap-2 flex-shrink-0 ml-4">
        {onNavigateToAssets && (
          <button
            onClick={onNavigateToAssets}
            className="px-4 py-2 rounded-md text-sm font-medium bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
          >
            Add Assets
          </button>
        )}
        {onNavigateToScripts && (
          <button
            onClick={onNavigateToScripts}
            className="px-4 py-2 rounded-md text-sm text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors"
          >
            Skip to Scripts
          </button>
        )}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Pass onNavigateToAssets from workspace-page to artifact-canvas**

In workspace-page.tsx, find where ArtifactCanvas is rendered and add the new prop:

```typescript
onNavigateToAssets={handleNavigateToAssets}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/components/workspace/workspace-page.tsx src/components/workspace/artifact-canvas.tsx
git commit -m "feat(assets): wire asset collection phase into workspace with state machine"
```

---

## Task 8: Script Generation API — Fetch + Pass Brand Voice

**Files:**
- Modify: `src/app/api/scripts/generate/route.ts:22-28` (select), `:107-143` (dispatch + snapshot)

- [ ] **Step 1: Add brand_voice_notes to profile select**

Find the profile query (~line 22):

```typescript
.select('id, company_name, style_references, proof_points')
```

Change to:

```typescript
.select('id, company_name, style_references, proof_points, brand_voice_notes')
```

- [ ] **Step 2: Add brandVoiceNotes to generation_context snapshot**

Find where `generation_context` is built (the script_packs insert). Add:

```typescript
brandVoiceNotesSnapshot: profile.brand_voice_notes ?? null,
```

- [ ] **Step 3: Add brandVoiceNotes to worker dispatch payload**

Find the `body: JSON.stringify({` block that sends to the worker (~line 136). Add alongside `proofPoints`:

```typescript
brandVoiceNotes: profile.brand_voice_notes ?? null,
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/scripts/generate/route.ts
git commit -m "feat(assets): pass brandVoiceNotes through script generation pipeline"
```

---

## Task 9: Worker — Parse + Forward Brand Voice

**Files:**
- Modify: `research-worker/src/index.ts:401-425` (HTTP handler)
- Modify: `research-worker/src/runners/ad-scripts.ts:146-165` (AdScriptsInput), `:174-179` (formatting), `:243-288` (prompt calls)

- [ ] **Step 1: Add brandVoiceNotes to HTTP handler destructuring**

In `research-worker/src/index.ts`, find the `/api/scripts` handler (~line 402):

```typescript
const { packId, profileId, sessionId, userId, companyName, researchContext, styleReferences, proofPoints } = req.body;
```

Change to:

```typescript
const { packId, profileId, sessionId, userId, companyName, researchContext, styleReferences, proofPoints, brandVoiceNotes } = req.body;
```

- [ ] **Step 2: Add to PipelineInput (v2) and AdScriptsInput (v1)**

In the same handler, find where `PipelineInput` is constructed (~line 419). Add:

```typescript
brandVoiceNotes: brandVoiceNotes ?? null,
```

Find where `AdScriptsInput` is constructed (~line 453). Add:

```typescript
brandVoiceNotes: brandVoiceNotes ?? null,
```

- [ ] **Step 3: Update AdScriptsInput interface**

In `research-worker/src/runners/ad-scripts.ts`, find the interface (~line 146):

```typescript
export interface AdScriptsInput {
  companyName: string;
  researchContext: Record<string, unknown>;
  styleReferences: Array<{ name: string; content: string; source: string }>;
  targetAudience: string;
  proofPoints?: ProofPoint[];
}
```

Add after `proofPoints`:

```typescript
brandVoiceNotes?: {
  tone: string;
  constraints: string;
  goodExample: string;
  badExample: string;
} | null;
```

- [ ] **Step 4: Format brandVoiceNotes for prompt injection**

In the same file, find where `styleRefText` is built (~line 174). After it, add:

```typescript
const brandVoiceText = input.brandVoiceNotes && (input.brandVoiceNotes.tone || input.brandVoiceNotes.constraints)
  ? input.brandVoiceNotes
  : null;
```

- [ ] **Step 5: Pass to buildPass1Prompt**

Find the `buildPass1Prompt` call (~line 243). Add to the opts object:

```typescript
brandVoiceNotes: brandVoiceText,
```

- [ ] **Step 6: Pass to buildPass2Prompt**

Find the `buildPass2Prompt` call (~line 283). Add to the opts object:

```typescript
brandVoiceNotes: brandVoiceText,
```

- [ ] **Step 7: Verify worker build**

```bash
cd research-worker && npx tsc --noEmit && cd ..
```

- [ ] **Step 8: Commit**

```bash
git add research-worker/src/index.ts research-worker/src/runners/ad-scripts.ts
git commit -m "feat(assets): wire brandVoiceNotes through worker pipeline"
```

---

## Task 10: Prompt Engineering — Pass 1 + Pass 2 Injection

**Files:**
- Modify: `research-worker/src/prompts/ad-scripts-pass1.ts:1-20` (opts interface), inject blocks
- Modify: `research-worker/src/prompts/ad-scripts-pass2.ts:1-15` (opts interface), inject blocks

- [ ] **Step 1: Update buildPass1Prompt opts interface**

In `research-worker/src/prompts/ad-scripts-pass1.ts`, find the function signature (~line 1). Add to the opts type:

```typescript
brandVoiceNotes?: {
  tone: string;
  constraints: string;
  goodExample: string;
  badExample: string;
} | null;
```

- [ ] **Step 2: Add brand voice blocks to Pass 1 prompt**

Inside `buildPass1Prompt`, build the brand voice sections. Add BEFORE the style references section (constraints get high attention position):

```typescript
const brandConstraintsSection = opts.brandVoiceNotes?.constraints
  ? `
## BRAND VOICE — HARD RULES (NEVER VIOLATE)
${opts.brandVoiceNotes.constraints}
These are non-negotiable. Every script must comply.
`
  : '';

const brandToneSection = opts.brandVoiceNotes?.tone
  ? `
## BRAND VOICE — TONE
${opts.brandVoiceNotes.tone}
Write in this register. Match this personality throughout.
`
  : '';

const brandExamplesSection = opts.brandVoiceNotes?.goodExample || opts.brandVoiceNotes?.badExample
  ? `
## BRAND VOICE — EXAMPLES
${opts.brandVoiceNotes.goodExample ? `GOOD (match this): ${opts.brandVoiceNotes.goodExample}` : ''}
${opts.brandVoiceNotes.badExample ? `BAD (never this): ${opts.brandVoiceNotes.badExample}` : ''}
Study the difference. Your output should read like the "good" example.
`
  : '';
```

Then inject them in the prompt string. `brandConstraintsSection` goes BEFORE style references. `brandToneSection` and `brandExamplesSection` go AFTER proof points:

```typescript
// In the prompt template string:
${brandConstraintsSection}
${styleSection}
${proofSection}
${brandToneSection}
${brandExamplesSection}
```

- [ ] **Step 3: Update buildPass2Prompt opts interface**

In `research-worker/src/prompts/ad-scripts-pass2.ts`, add to opts:

```typescript
brandVoiceNotes?: {
  tone: string;
  constraints: string;
  goodExample: string;
  badExample: string;
} | null;
```

- [ ] **Step 4: Add brand voice blocks to Pass 2 prompt**

Add compliance check AND voice calibration:

```typescript
const brandVoicePass2 = opts.brandVoiceNotes
  ? `
## BRAND VOICE COMPLIANCE CHECK
Before returning each script, verify it doesn't violate these rules:
${opts.brandVoiceNotes.constraints || 'No specific constraints.'}

${opts.brandVoiceNotes.tone ? `Target tone: ${opts.brandVoiceNotes.tone}` : ''}
${opts.brandVoiceNotes.goodExample ? `Voice benchmark: ${opts.brandVoiceNotes.goodExample}` : ''}
If any script violates a rule or doesn't match the target tone, rewrite it.
`
  : '';
```

Inject after the style references section in the prompt template string.

- [ ] **Step 5: Verify worker build**

```bash
cd research-worker && npx tsc --noEmit && cd ..
```

- [ ] **Step 6: Commit**

```bash
git add research-worker/src/prompts/ad-scripts-pass1.ts research-worker/src/prompts/ad-scripts-pass2.ts
git commit -m "feat(assets): inject brand voice notes into script generation prompts"
```

---

## Task 11: Profile Page — Recompose StyleRefsTab

**Files:**
- Modify: `src/components/scripts/style-refs-tab.tsx`

- [ ] **Step 1: Recompose StyleRefsTab to use shared sub-components**

Replace the internals of StyleRefsTab with the shared components. Keep the same props interface for backward compatibility. Add brand voice as a third tab.

```typescript
'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AssetStyleRefs } from '@/components/assets/asset-style-refs';
import { AssetProofPoints } from '@/components/assets/asset-proof-points';
import { AssetBrandVoice } from '@/components/assets/asset-brand-voice';
import type { StyleReference, ProofPoint, BrandVoiceNotes } from '@/lib/profiles/business-profiles';

interface StyleRefsTabProps {
  profileId: string;
  initialRefs: StyleReference[] | null;
  initialProofPoints?: ProofPoint[];
  initialBrandVoice?: BrandVoiceNotes | null;
}

type Tab = 'style-refs' | 'proof-points' | 'voice';

const TABS: { id: Tab; label: string }[] = [
  { id: 'style-refs', label: 'Style References' },
  { id: 'proof-points', label: 'Proof Points' },
  { id: 'voice', label: 'Brand Voice' },
];

export function StyleRefsTab({ profileId, initialRefs, initialProofPoints, initialBrandVoice }: StyleRefsTabProps) {
  const [activeTab, setActiveTab] = useState<Tab>('style-refs');
  const [styleRefs, setStyleRefs] = useState<StyleReference[]>(initialRefs ?? []);
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>(initialProofPoints ?? []);
  const [brandVoice, setBrandVoice] = useState<BrandVoiceNotes | null>(initialBrandVoice ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const persist = useCallback(async (
    refs: StyleReference[],
    points: ProofPoint[],
    voice: BrandVoiceNotes | null,
  ) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/style-references`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          styleReferences: refs,
          proofPoints: points,
          brandVoiceNotes: voice,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        setSaveError(err.error ?? 'Save failed');
      }
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  }, [profileId]);

  const handleStyleRefsChange = useCallback((refs: StyleReference[]) => {
    setStyleRefs(refs);
    persist(refs, proofPoints, brandVoice);
  }, [proofPoints, brandVoice, persist]);

  const handleProofPointsChange = useCallback((points: ProofPoint[]) => {
    setProofPoints(points);
    persist(styleRefs, points, brandVoice);
  }, [styleRefs, brandVoice, persist]);

  const handleBrandVoiceChange = useCallback((voice: BrandVoiceNotes) => {
    setBrandVoice(voice);
    persist(styleRefs, proofPoints, voice);
  }, [styleRefs, proofPoints, persist]);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border-subtle)] mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-5 py-2.5 text-[13px] font-medium transition-colors border-b-2',
              activeTab === tab.id
                ? 'text-[var(--text-primary)] border-[var(--accent-blue)]'
                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'style-refs' && (
        <AssetStyleRefs refs={styleRefs} onChange={handleStyleRefsChange} />
      )}
      {activeTab === 'proof-points' && (
        <AssetProofPoints points={proofPoints} onChange={handleProofPointsChange} />
      )}
      {activeTab === 'voice' && (
        <AssetBrandVoice value={brandVoice} onChange={handleBrandVoiceChange} />
      )}

      {/* Save status */}
      <div className="mt-4 text-xs">
        {saving && <span className="text-[var(--text-muted)]">Saving...</span>}
        {saveError && <span className="text-red-400">{saveError}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update profile detail page to pass brandVoice prop**

In `src/app/profiles/[id]/page.tsx`, find where `StyleRefsTab` is rendered. Add:

```typescript
initialBrandVoice={profile.brandVoiceNotes}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/scripts/style-refs-tab.tsx src/app/profiles/[id]/page.tsx
git commit -m "refactor(assets): recompose StyleRefsTab with shared components + brand voice tab"
```

---

## Task 12: Verify End-to-End

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: exit 0 with no errors.

- [ ] **Step 2: Worker build**

```bash
cd research-worker && npx tsc --noEmit && cd ..
```

Expected: exit 0.

- [ ] **Step 3: Start dev server and test the flow**

```bash
npm run dev
```

Test in browser:
1. Navigate to `/journey` with a run that has completed media plan
2. Verify the asset CTA appears with "Add Assets" and "Skip to Scripts" buttons
3. Click "Add Assets" — verify the AssetCollectionPhase renders
4. Add a style reference, switch to proof points tab, add one, switch to brand voice, type tone
5. Verify auto-save indicator shows
6. Click "Generate Scripts" — verify it flushes save then navigates to scripts phase
7. Navigate to `/profiles/[id]` — verify assets appear in the Assets tab with brand voice
8. Test the skip path: refresh, click "Skip to Scripts" — verify scripts generate without assets

- [ ] **Step 4: Commit final verification**

```bash
git add -A
git commit -m "feat(assets): asset collection phase — complete end-to-end implementation"
```
