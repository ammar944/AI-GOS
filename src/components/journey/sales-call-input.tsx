'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SalesCallInputProps {
  onSubmit: (shareUrl: string) => Promise<void>;
  disabled?: boolean;
}

const FATHOM_URL_PATTERN = /^https:\/\/fathom\.video\/share\/.+$/;

export function SalesCallInput({ onSubmit, disabled }: SalesCallInputProps) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = FATHOM_URL_PATTERN.test(url.trim());

  async function handleSubmit() {
    if (!isValid || submitting || disabled) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(url.trim());
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add call');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="Paste Fathom meeting link..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          disabled={disabled || submitting}
          className={cn(
            'flex-1 rounded-lg border bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            error && 'border-destructive',
          )}
        />
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting || disabled}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center gap-2',
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Add Call
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
