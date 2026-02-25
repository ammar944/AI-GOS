"use client";

import { ApiErrorDisplay } from "@/components/ui/api-error-display";
import type { ParsedApiError } from "@/components/ui/api-error-display";
import { GenerateHeader } from "@/components/generate";
import type { GenerateStage } from "@/components/generate";

export interface ErrorViewProps {
  headerStage: GenerateStage;
  error: ParsedApiError;
  hasUnsavedProgress: boolean;
  onRetry: () => void;
  onStartOver: () => void;
}

export function ErrorView({ headerStage, error, hasUnsavedProgress, onRetry, onStartOver }: ErrorViewProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <GenerateHeader
        currentStage={headerStage}
        hasUnsavedProgress={hasUnsavedProgress}
        onExit={onStartOver}
        exitUrl="/dashboard"
      />
      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <ApiErrorDisplay error={error} onRetry={onRetry} onGoBack={onStartOver} />
        </div>
      </div>
    </div>
  );
}
