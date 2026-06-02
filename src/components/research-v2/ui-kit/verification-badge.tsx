import { AlertTriangle, Check } from 'lucide-react';

export function VerificationBadge({
  verified,
  flagged,
}: {
  verified: number;
  flagged: number;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] tabular-nums">
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <Check className="size-3" strokeWidth={3} />
        {verified}
      </span>
      {flagged > 0 ? (
        <span className="inline-flex items-center gap-1 text-amber-600">
          <AlertTriangle className="size-3" strokeWidth={2.5} />
          {flagged}
        </span>
      ) : null}
    </span>
  );
}
