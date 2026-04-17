"use client";

export interface StatusStripProps {
  researching: number;
  queued: number;
  etaLabel?: string;
  sources?: string[];
}

export function StatusStrip({
  researching,
  queued,
  etaLabel,
  sources = [],
}: StatusStripProps) {
  const hasActivity = researching > 0 || queued > 0;
  const tickerItems = sources.length ? [...sources, ...sources] : [];

  return (
    <div className="v3-status-strip">
      {hasActivity ? (
        <>
          <span className="v3-live">
            <span className="v3-pulse" aria-hidden="true" />
            {researching} researching
          </span>
          {queued > 0 && (
            <>
              <span className="v3-sep">·</span>
              <span>{queued} queued</span>
            </>
          )}
          {etaLabel && (
            <>
              <span className="v3-sep">·</span>
              <span>{etaLabel}</span>
            </>
          )}
          {tickerItems.length > 0 && (
            <>
              <span className="v3-sep">·</span>
              <span className="v3-ticker" aria-hidden="true">
                <span className="v3-ticker-inner">
                  {tickerItems.map((s, i) => (
                    <span key={`${s}-${i}`}>{s}</span>
                  ))}
                </span>
              </span>
            </>
          )}
        </>
      ) : (
        <span className="v3-tertiary">ready</span>
      )}
    </div>
  );
}
