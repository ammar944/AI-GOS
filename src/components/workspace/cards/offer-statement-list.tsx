'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OfferStatement {
  type: string;
  statement: string;
  rationale: string;
  targetEmotion: string;
}

interface OfferStatementListProps {
  statements: OfferStatement[];
}

export function OfferStatementList({ statements }: OfferStatementListProps) {
  if (!statements.length) return null;

  return (
    <div className="space-y-0">
      {statements.map((s, i) => (
        <OfferRow key={i} statement={s} isLast={i === statements.length - 1} />
      ))}
    </div>
  );
}

function OfferRow({ statement, isLast }: { statement: OfferStatement; isLast: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(statement.statement);
    } catch {
      const el = document.createElement('textarea');
      el.value = statement.statement;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [statement.statement]);

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 py-2.5',
        !isLast && 'border-b border-[var(--border-subtle)]'
      )}
    >
      <span
        className="mt-0.5 shrink-0 rounded-[3px] px-1.5 py-px font-mono text-[9px] font-medium uppercase tracking-[0.04em]"
        style={{ color: 'var(--accent-blue)', background: 'var(--accent-blue-subtle, rgba(54,94,255,0.08))' }}
      >
        {statement.type}
      </span>
      <span className="flex-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {statement.statement}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] transition-colors"
        style={{
          color: copied ? 'var(--accent-green, #22c55e)' : 'var(--text-quaternary)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
