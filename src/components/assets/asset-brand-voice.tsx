'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandVoiceNotes } from '@/lib/profiles/business-profiles';

interface AssetBrandVoiceProps {
  value: BrandVoiceNotes | null;
  onChange: (notes: BrandVoiceNotes) => void;
  disabled?: boolean;
}

const DEFAULT: BrandVoiceNotes = { tone: '', constraints: '', goodExample: '', badExample: '' };

// ─── Tone chips ─────────────────────────────────────────────────────────────

const TONE_CHIPS = [
  'Authoritative', 'Casual', 'Data-driven', 'Conversational',
  'Provocative', 'Empathetic', 'Urgent', 'No-BS',
  'Aspirational', 'Technical', 'Humorous', 'Premium',
] as const;

function parseTone(raw: string): { chips: string[]; note: string } {
  const match = raw.match(/^\[([^\]]*)\]\s*([\s\S]*)$/);
  if (match) {
    const chips = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { chips, note: match[2].trim() };
  }
  // Legacy plain text: keep as note, no chips selected
  return { chips: [], note: raw };
}

function serializeTone(chips: string[], note: string): string {
  if (chips.length === 0 && note === '') return '';
  if (chips.length === 0) return note;
  const chipPart = `[${chips.join(', ')}]`;
  return note ? `${chipPart} ${note}` : chipPart;
}

// ─── Constraints (rules) ─────────────────────────────────────────────────────

type RuleType = 'ALWAYS' | 'NEVER';

interface Rule {
  id: string;
  type: RuleType;
  text: string;
}

function parseConstraints(raw: string): Rule[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      if (line.startsWith('ALWAYS: ')) {
        return { id: `r${i}`, type: 'ALWAYS' as RuleType, text: line.slice(8) };
      }
      if (line.startsWith('NEVER: ')) {
        return { id: `r${i}`, type: 'NEVER' as RuleType, text: line.slice(7) };
      }
      // Legacy lines without prefix → default to ALWAYS
      return { id: `r${i}`, type: 'ALWAYS' as RuleType, text: line };
    });
}

function serializeConstraints(rules: Rule[]): string {
  return rules.map((r) => `${r.type}: ${r.text}`).join('\n');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AssetBrandVoice({ value, onChange, disabled }: AssetBrandVoiceProps) {
  const [notes, setNotes] = useState<BrandVoiceNotes>(value ?? DEFAULT);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived tone state
  const { chips: selectedChips, note: toneNote } = parseTone(notes.tone);
  // Derived rules state
  const rules = parseConstraints(notes.constraints);

  // Reference examples collapsed state
  const [goodOpen, setGoodOpen] = useState(false);
  const [badOpen, setBadOpen] = useState(false);

  // New rule input state
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleType, setNewRuleType] = useState<RuleType>('ALWAYS');

  useEffect(() => {
    if (value) setNotes(value);
  }, [value]);

  const fire = useCallback(
    (updated: BrandVoiceNotes) => {
      setNotes(updated);
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(updated), 500);
    },
    [onChange],
  );

  // ── Tone handlers ──

  const toggleChip = useCallback(
    (chip: string) => {
      if (disabled) return;
      const next = selectedChips.includes(chip)
        ? selectedChips.filter((c) => c !== chip)
        : [...selectedChips, chip];
      fire({ ...notes, tone: serializeTone(next, toneNote) });
    },
    [disabled, selectedChips, toneNote, notes, fire],
  );

  const handleToneNote = useCallback(
    (val: string) => {
      fire({ ...notes, tone: serializeTone(selectedChips, val) });
    },
    [selectedChips, notes, fire],
  );

  // ── Rule handlers ──

  const addRule = useCallback(() => {
    const text = newRuleText.trim();
    if (!text || disabled) return;
    const updated: Rule[] = [...rules, { id: Date.now().toString(), type: newRuleType, text }];
    fire({ ...notes, constraints: serializeConstraints(updated) });
    setNewRuleText('');
  }, [newRuleText, newRuleType, disabled, rules, notes, fire]);

  const removeRule = useCallback(
    (id: string) => {
      if (disabled) return;
      const updated = rules.filter((r) => r.id !== id);
      fire({ ...notes, constraints: serializeConstraints(updated) });
    },
    [disabled, rules, notes, fire],
  );

  // ── Example handlers ──

  const handleExample = useCallback(
    (field: 'goodExample' | 'badExample', val: string) => {
      fire({ ...notes, [field]: val.slice(0, 1500) });
    },
    [notes, fire],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Callout */}
      <div className="border-l-2 border-[#365eff] pl-4 py-3">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-1">
          How it works
        </div>
        <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">
          These notes become{' '}
          <strong className="text-gray-900 dark:text-gray-100 font-medium">hard constraints</strong> for the script
          generator — followed in every script across all awareness levels.
        </p>
      </div>

      {/* Section 1: Tone & Personality */}
      <div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-['Instrument_Sans'] text-[14px] font-medium text-gray-900 dark:text-gray-100">
            Tone &amp; personality
          </span>
          <span className="text-[13px] text-muted-foreground">— pick what fits, add your own</span>
        </div>

        {/* Chip grid */}
        <div className="flex flex-wrap gap-2 mb-3">
          {TONE_CHIPS.map((chip) => {
            const active = selectedChips.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => toggleChip(chip)}
                disabled={disabled}
                className={cn(
                  'px-3 py-1 text-[13px] font-medium rounded-full border cursor-pointer transition-all duration-150',
                  active
                    ? 'text-[#365eff] bg-[rgba(54,94,255,0.08)] border-[rgba(54,94,255,0.2)]'
                    : 'text-muted-foreground bg-gray-100 dark:bg-gray-800 border-border hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                {chip}
              </button>
            );
          })}
        </div>

        {/* Custom note */}
        <input
          type="text"
          value={toneNote}
          onChange={(e) => handleToneNote(e.target.value)}
          disabled={disabled}
          placeholder="Add a custom note about your tone..."
          className={cn(
            'w-full rounded-[5px] border border-border bg-gray-100 dark:bg-gray-800',
            'px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 placeholder:text-muted-foreground',
            'focus:outline-none focus:border-[rgba(54,94,255,0.4)]',
            'transition-colors duration-150',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      </div>

      {/* Section 2: Hard Rules */}
      <div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-['Instrument_Sans'] text-[14px] font-medium text-gray-900 dark:text-gray-100">
            Hard rules
          </span>
          <span className="text-[13px] text-muted-foreground">— always or never</span>
        </div>

        {/* Rules list */}
        {rules.length > 0 && (
          <div className="flex flex-col gap-px bg-border rounded-[5px] overflow-hidden mb-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-150 group"
              >
                {/* Dot */}
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    rule.type === 'ALWAYS' ? 'bg-[#22c55e]' : 'bg-[#ef4444]',
                  )}
                />
                {/* Text */}
                <span className="text-[13px] text-gray-700 dark:text-gray-300 flex-1 min-w-0">{rule.text}</span>
                {/* Tag */}
                <span
                  className={cn(
                    'font-mono text-[10px] font-medium px-1.5 py-px rounded-[3px] flex-shrink-0',
                    rule.type === 'ALWAYS'
                      ? 'text-[#22c55e] bg-[rgba(34,197,94,0.08)]'
                      : 'text-[#ef4444] bg-[rgba(239,68,68,0.08)]',
                  )}
                >
                  {rule.type}
                </span>
                {/* Delete */}
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  disabled={disabled}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-muted-foreground hover:text-[#ef4444] flex-shrink-0 disabled:cursor-not-allowed"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add rule input */}
        <div className="flex items-center gap-0 rounded-[5px] border border-border bg-gray-100 dark:bg-gray-800 overflow-hidden focus-within:border-[rgba(54,94,255,0.4)] transition-colors duration-150">
          {/* Type toggle */}
          <select
            value={newRuleType}
            onChange={(e) => setNewRuleType(e.target.value as RuleType)}
            disabled={disabled}
            className={cn(
              'bg-gray-200 dark:bg-gray-700 border-r border-border px-2.5 py-2',
              'font-mono text-[11px] font-medium cursor-pointer focus:outline-none',
              'flex-shrink-0',
              newRuleType === 'ALWAYS' ? 'text-[#22c55e]' : 'text-[#ef4444]',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <option value="ALWAYS">ALWAYS</option>
            <option value="NEVER">NEVER</option>
          </select>
          {/* Text input */}
          <input
            type="text"
            value={newRuleText}
            onChange={(e) => setNewRuleText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addRule();
              }
            }}
            disabled={disabled}
            placeholder="Type a rule and press Enter..."
            className={cn(
              'flex-1 px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 placeholder:text-muted-foreground',
              'bg-transparent focus:outline-none',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          />
          {/* Add button */}
          <button
            type="button"
            onClick={addRule}
            disabled={disabled || !newRuleText.trim()}
            className={cn(
              'px-2.5 py-2 text-muted-foreground hover:text-[#365eff] flex-shrink-0',
              'transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed',
            )}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* Section 3: Reference Examples */}
      <div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-['Instrument_Sans'] text-[14px] font-medium text-gray-900 dark:text-gray-100">
            Reference examples
          </span>
          <span className="text-[13px] text-muted-foreground">— show the AI your voice</span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Good example block */}
          <div className="border border-border rounded-[5px] overflow-hidden">
            <button
              type="button"
              onClick={() => setGoodOpen((v) => !v)}
              className="w-full flex justify-between items-center px-3.5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] flex-shrink-0" />
                <span className="text-[13px] text-gray-700 dark:text-gray-300">Copy that sounds like us</span>
                {notes.goodExample && (
                  <span className="font-mono text-[10px] text-[#22c55e] bg-[rgba(34,197,94,0.08)] px-1.5 py-px rounded-[3px]">
                    {notes.goodExample.length} chars
                  </span>
                )}
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  'text-muted-foreground transition-transform duration-200',
                  goodOpen && 'rotate-180',
                )}
              />
            </button>
            {goodOpen && (
              <div className="bg-white dark:bg-gray-900 px-3.5 pb-3.5 pt-2.5">
                <textarea
                  value={notes.goodExample}
                  onChange={(e) => handleExample('goodExample', e.target.value)}
                  disabled={disabled}
                  placeholder="Paste an example of copy that sounds exactly like your brand..."
                  rows={5}
                  className={cn(
                    'w-full bg-transparent text-[13px] text-gray-700 dark:text-gray-300 placeholder:text-muted-foreground',
                    'resize-none focus:outline-none border-none p-0 leading-relaxed',
                    disabled && 'opacity-50 cursor-not-allowed',
                  )}
                />
                <div className="text-right text-[11px] text-muted-foreground mt-1">
                  {notes.goodExample.length}/1500
                </div>
              </div>
            )}
          </div>

          {/* Bad example block */}
          <div className="border border-border rounded-[5px] overflow-hidden">
            <button
              type="button"
              onClick={() => setBadOpen((v) => !v)}
              className="w-full flex justify-between items-center px-3.5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] flex-shrink-0" />
                <span className="text-[13px] text-gray-700 dark:text-gray-300">Copy that is NOT us</span>
                {notes.badExample && (
                  <span className="font-mono text-[10px] text-[#ef4444] bg-[rgba(239,68,68,0.08)] px-1.5 py-px rounded-[3px]">
                    {notes.badExample.length} chars
                  </span>
                )}
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  'text-muted-foreground transition-transform duration-200',
                  badOpen && 'rotate-180',
                )}
              />
            </button>
            {badOpen && (
              <div className="bg-white dark:bg-gray-900 px-3.5 pb-3.5 pt-2.5">
                <textarea
                  value={notes.badExample}
                  onChange={(e) => handleExample('badExample', e.target.value)}
                  disabled={disabled}
                  placeholder="Paste an example of what your brand should never sound like..."
                  rows={5}
                  className={cn(
                    'w-full bg-transparent text-[13px] text-gray-700 dark:text-gray-300 placeholder:text-muted-foreground',
                    'resize-none focus:outline-none border-none p-0 leading-relaxed',
                    disabled && 'opacity-50 cursor-not-allowed',
                  )}
                />
                <div className="text-right text-[11px] text-muted-foreground mt-1">
                  {notes.badExample.length}/1500
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
