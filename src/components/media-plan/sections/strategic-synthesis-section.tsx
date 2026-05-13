"use client";

import * as React from "react";
import type { MediaPlanStrategicSynthesis } from "@/lib/media-plan/types";
import { SubSection, type EditingProps } from "./shared";

/**
 * Page 1 of the media plan — strategic synthesis. Folded in from the
 * (now-deprecated) ai-gos-gtm-synthesis + ai-gos-activation-plan skills
 * on 2026-05-13. Optional at runtime: legacy media plans generated
 * before the fold-in won't have this field, so the renderer skips when
 * `data` is undefined.
 *
 * Read-only for now — editing the synthesis means re-running generation,
 * not patching individual fields.
 */
export function StrategicSynthesisContent({
  data,
}: { data: MediaPlanStrategicSynthesis | undefined } & EditingProps) {
  if (!data) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        This media plan was generated before the strategic-synthesis fold-in
        (2026-05-13). Regenerate the plan to surface a Page 1 synthesis.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
          Verdict · confidence {data.confidence}
        </p>
        <p
          className="text-xl font-semibold leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {data.verdict}
        </p>
      </div>

      <SubSection title="Positioning Thesis">
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {data.positioningThesis}
        </p>
      </SubSection>

      <SubSection title="Strategic Narrative">
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {data.strategicNarrative}
        </p>
      </SubSection>

      {data.topActions.length > 0 && (
        <SubSection title="Top Actions">
          <div className="grid gap-3">
            {data.topActions.map((action, idx) => (
              <div key={idx} className="rounded-md border border-border bg-card p-3">
                <div className="mb-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  <span
                    className="rounded px-1.5 py-0.5"
                    style={{
                      background:
                        action.priority === "high"
                          ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                          : action.priority === "medium"
                            ? "color-mix(in srgb, var(--amber) 18%, transparent)"
                            : "color-mix(in srgb, var(--text-tertiary) 14%, transparent)",
                      color:
                        action.priority === "high"
                          ? "var(--accent)"
                          : action.priority === "medium"
                            ? "var(--amber)"
                            : "var(--text-tertiary)",
                    }}
                  >
                    {action.priority}
                  </span>
                  <span>Priority</span>
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {action.action}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {action.rationale}
                </p>
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {data.contradictions.length > 0 && (
        <SubSection title="Cross-Section Contradictions">
          <div className="grid gap-3">
            {data.contradictions.map((c, idx) => (
              <div key={idx} className="rounded-md border border-border bg-card p-3">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {c.contradiction}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  <span className="font-semibold">Impact:</span> {c.impact}
                </p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  <span className="font-semibold">Resolve:</span> {c.resolution}
                </p>
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {(data.crossCardReadiness.locked.length > 0 ||
        data.crossCardReadiness.gaps.length > 0) && (
        <SubSection title="Cross-Card Readiness">
          <div className="grid gap-4 md:grid-cols-2">
            {data.crossCardReadiness.locked.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide" style={{ color: "var(--green)" }}>
                  Locked
                </p>
                <ul className="space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {data.crossCardReadiness.locked.map((entry, idx) => (
                    <li key={idx}>· {entry}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.crossCardReadiness.gaps.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide" style={{ color: "var(--amber)" }}>
                  Gaps
                </p>
                <ul className="space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {data.crossCardReadiness.gaps.map((entry, idx) => (
                    <li key={idx}>· {entry}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SubSection>
      )}
    </div>
  );
}
