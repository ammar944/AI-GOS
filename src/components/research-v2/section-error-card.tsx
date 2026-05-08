'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

interface SectionErrorCardProps {
  runId: string;
  sectionId: PositioningSectionId;
  sectionLabel: string;
  errorMessage?: string;
  onRetry: (sectionId: PositioningSectionId) => void;
  onSkip: (sectionId: PositioningSectionId) => void;
}

export function SectionErrorCard({
  sectionId,
  sectionLabel,
  errorMessage,
  onRetry,
  onSkip,
}: SectionErrorCardProps) {
  return (
    <Alert variant="destructive" className="rounded-lg">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Section failed: {sectionLabel}</AlertTitle>
      <AlertDescription className="mt-1 space-y-3">
        {errorMessage && (
          <p className="text-sm">{errorMessage}</p>
        )}
        <div className="flex gap-2 mt-2">
          <Button
            variant="destructive"
            size="sm"
            className="rounded-md"
            onClick={() => onRetry(sectionId)}
          >
            Retry section
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-md"
            onClick={() => onSkip(sectionId)}
          >
            Skip section
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
