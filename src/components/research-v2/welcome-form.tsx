'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WelcomeFormProps {
  onSubmit: (url: string) => Promise<void>;
  isLoading?: boolean;
}

function parseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Prepend https if no protocol given
  const candidate = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  try {
    new URL(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export function WelcomeForm({ onSubmit, isLoading = false }: WelcomeFormProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const url = parseUrl(value);
    if (!url) {
      setError('Please enter a valid URL (e.g. https://example.com)');
      return;
    }

    await onSubmit(url);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-svh px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Pre-Pitch Positioning Audit
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a company URL to begin deep research. Takes 30–60 seconds.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="https://example.com"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              disabled={isLoading}
              className={cn(
                'h-11 rounded-md text-sm',
                error && 'border-destructive focus-visible:ring-destructive',
              )}
              autoFocus
              aria-label="Company URL"
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-md"
            disabled={isLoading || !value.trim()}
          >
            {isLoading ? 'Starting research…' : 'Start research'}
          </Button>
        </form>
      </div>
    </div>
  );
}
