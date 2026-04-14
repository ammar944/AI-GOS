'use client';

import type { MeetingInsights } from '@/lib/meeting-intel/types';

interface MeetingInsightGridProps {
  insights: MeetingInsights;
}

function InsightCategory({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

export function MeetingInsightGrid({ insights }: MeetingInsightGridProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <InsightCategory label={`Pain Points (${insights.painPoints.length})`} color="#6c5ce7">
          {insights.painPoints.length > 0 ? (
            insights.painPoints.map((p, i) => (
              <div key={i}>
                <span className="text-foreground">{p.pain}</span>
                {p.quote && (
                  <span className="ml-1 text-muted-foreground/70">
                    &mdash; &ldquo;{p.quote}&rdquo;
                  </span>
                )}
              </div>
            ))
          ) : (
            <span className="italic">None mentioned</span>
          )}
        </InsightCategory>

        <InsightCategory label="Budget Signals" color="#fdcb6e">
          {insights.budgetSignals.mentionedSpend && (
            <div>Spend: {insights.budgetSignals.mentionedSpend}</div>
          )}
          <div>
            Sensitivity:{' '}
            <span
              className="font-medium"
              style={{
                color:
                  insights.budgetSignals.priceSensitivity === 'low'
                    ? '#00b894'
                    : insights.budgetSignals.priceSensitivity === 'high'
                      ? '#e17055'
                      : '#fdcb6e',
              }}
            >
              {insights.budgetSignals.priceSensitivity}
            </span>
          </div>
          {insights.budgetSignals.willingnessToPay && (
            <div>&ldquo;{insights.budgetSignals.willingnessToPay}&rdquo;</div>
          )}
        </InsightCategory>

        <InsightCategory label={`Competitors (${insights.competitorMentions.length})`} color="#e17055">
          {insights.competitorMentions.length > 0 ? (
            insights.competitorMentions.map((c, i) => (
              <div key={i}>
                <span className="font-medium text-foreground">{c.name}</span>{' '}
                <span
                  style={{
                    color: c.sentiment === 'positive' ? '#00b894' : c.sentiment === 'negative' ? '#e17055' : '#fdcb6e',
                  }}
                >
                  ({c.sentiment})
                </span>
                : {c.context}
              </div>
            ))
          ) : (
            <span className="italic">None mentioned</span>
          )}
        </InsightCategory>

        <InsightCategory label="Buying Signals" color="#00b894">
          {insights.buyingTriggers.length > 0 ? (
            insights.buyingTriggers.map((t, i) => (
              <div key={i}>
                <span className="text-foreground">{t.trigger}</span>{' '}
                <span
                  className="text-[10px]"
                  style={{
                    color: t.urgency === 'immediate' ? '#e17055' : t.urgency === 'near_term' ? '#fdcb6e' : '#00b894',
                  }}
                >
                  ({t.urgency.replace('_', ' ')})
                </span>
              </div>
            ))
          ) : (
            <span className="italic">None mentioned</span>
          )}
        </InsightCategory>
      </div>

      <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          Business Health Summary
        </div>
        <p className="text-xs italic text-muted-foreground leading-relaxed">
          {insights.businessHealthSummary}
        </p>
      </div>
    </div>
  );
}
