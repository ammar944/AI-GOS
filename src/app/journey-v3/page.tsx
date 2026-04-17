"use client";

import { useState } from "react";
import { WorkspaceShell } from "@/components/workspace-v3/workspace-shell";
import { StatusStrip } from "@/components/workspace-v3/status-strip";

/**
 * Phase 2a preview route for the journey-workspace-v3 redesign.
 * Renders the new shell (top bar + peek rail + canvas + chat chip) with mock
 * state so we can visually verify before integrating into the real journey page.
 *
 * Compare against the production shell at /journey.
 */
export default function JourneyV3PreviewPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const crumbs = [
    { label: "Nike Direct", dim: true },
    { label: "Industry Research" },
  ];

  const peekGroups = [
    {
      label: "Journey",
      items: [
        { label: "Onboarding" },
        { label: "Research", active: true },
        { label: "Media Plan" },
        { label: "Scripts" },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Normal", active: true },
        { label: "Verbose" },
        { label: "Summary" },
      ],
    },
  ];

  const sources = [
    "g2.com",
    "linkedin.com",
    "apollo.io",
    "capterra.com",
    "gartner.com",
    "reddit.com",
  ];

  return (
    <WorkspaceShell
      crumbs={crumbs}
      topBarCenter={
        <StatusStrip
          researching={4}
          queued={2}
          etaLabel="02:14 est."
          sources={sources}
        />
      }
      peekGroups={peekGroups}
      usage="$0.42"
      onCommandMenuOpen={() => setCommandOpen((v) => !v)}
      onChatToggle={() => setChatOpen((v) => !v)}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 32 }}>
        <h1 className="v3-display">Research</h1>
        <span className="v3-mono-label">2 of 8 complete</span>
      </div>

      <section className="v3-card v3-card-sample">
        <div className="v3-card-head">
          <span className="v3-dot v3-dot-green" aria-hidden="true" />
          <h2 className="v3-card-title">Industry Market</h2>
          <span className="v3-card-meta">
            <span className="v3-ok">approved</span>
            <span className="v3-card-more">⋯</span>
          </span>
        </div>
        <div className="v3-stat-row">
          <div>
            <div className="v3-mono-label">Market size</div>
            <div className="v3-stat-value">
              $50.3<small> B</small>
            </div>
          </div>
          <div>
            <div className="v3-mono-label">Category</div>
            <div className="v3-stat-value">SaaS</div>
          </div>
          <div>
            <div className="v3-mono-label">Growth YoY</div>
            <div className="v3-stat-value">
              +12.4<small> %</small>
            </div>
          </div>
        </div>
        <p className="v3-summary">
          North American B2B SaaS growing 12.4% YoY. Segment concentration in
          devtools and vertical SaaS; horizontal productivity plateauing. Key
          buyer pressures: procurement consolidation, AI-feature parity,
          cost-per-seat governance.
        </p>
      </section>

      <section className="v3-card v3-card-sample">
        <div className="v3-card-head">
          <span className="v3-dot v3-dot-amber" aria-hidden="true" />
          <h2 className="v3-card-title">Competitors</h2>
          <span className="v3-card-meta">researching · 00:42 elapsed</span>
        </div>
        <div className="v3-skeleton-list">
          {[72, 58, 82, 64, 76].map((w, i) => (
            <div key={i} className="v3-skeleton-row">
              <div className="v3-skeleton-logo" />
              <div className="v3-skeleton-bar" style={{ width: `${w}%` }} />
              <div className="v3-skeleton-pill" />
            </div>
          ))}
        </div>
      </section>

      <section className="v3-card v3-card-sample v3-card-queued">
        <div className="v3-card-head">
          <span className="v3-dot v3-dot-idle" aria-hidden="true" />
          <h2 className="v3-card-title">ICP Validation</h2>
          <span className="v3-card-meta">queued</span>
        </div>
      </section>

      {(chatOpen || commandOpen) && (
        <div
          className="v3-mono-label"
          style={{ marginTop: 24, color: "var(--v3-accent)" }}
        >
          {commandOpen && "⌘K OPEN · "}
          {chatOpen && "⌘; OPEN"}
        </div>
      )}

      <style jsx>{`
        :global([data-v3]) .v3-card {
          background: var(--v3-bg-1);
          border: 1px solid var(--v3-hairline);
          border-radius: var(--v3-r-card);
          padding: 28px 32px 32px;
          margin-bottom: 20px;
          transition: border-color var(--v3-dur-hover) var(--v3-ease);
        }
        :global([data-v3]) .v3-card:hover {
          border-color: color-mix(
            in oklch,
            var(--v3-text-3),
            transparent 50%
          );
        }
        :global([data-v3]) .v3-card-queued {
          opacity: 0.45;
        }
        :global([data-v3]) .v3-card-head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        :global([data-v3]) .v3-dot {
          width: 6px;
          height: 6px;
          border-radius: var(--v3-r-pill);
          flex-shrink: 0;
        }
        :global([data-v3]) .v3-dot-green {
          background: var(--v3-success);
        }
        :global([data-v3]) .v3-dot-amber {
          background: var(--v3-warning);
          animation: v3-pulse 1.8s ease-in-out infinite;
        }
        :global([data-v3]) .v3-dot-idle {
          background: var(--v3-text-3);
        }
        :global([data-v3]) .v3-card-head .v3-card-title {
          flex: 1;
          margin: 0;
        }
        :global([data-v3]) .v3-card-meta {
          font: var(--v3-mono-xs);
          letter-spacing: var(--v3-ls-mono);
          color: var(--v3-text-2);
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        :global([data-v3]) .v3-ok {
          color: var(--v3-success);
          font-size: 10px;
          letter-spacing: var(--v3-ls-label);
          text-transform: uppercase;
          border: 1px solid
            color-mix(in oklch, var(--v3-success), transparent 70%);
          padding: 2px 6px;
          border-radius: var(--v3-r-hairline);
        }
        :global([data-v3]) .v3-card-more {
          color: var(--v3-text-3);
          cursor: pointer;
          padding: 2px 4px;
        }
        :global([data-v3]) .v3-stat-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
          margin-bottom: 22px;
        }
        :global([data-v3]) .v3-stat-value small {
          font: var(--v3-body-sm);
          color: var(--v3-text-2);
          margin-left: 2px;
        }
        :global([data-v3]) .v3-summary {
          color: var(--v3-text-2);
          font: var(--v3-body);
          line-height: 1.55;
          max-width: 68ch;
          margin: 0;
        }
        :global([data-v3]) .v3-skeleton-list {
          display: grid;
          gap: 0;
        }
        :global([data-v3]) .v3-skeleton-row {
          display: grid;
          grid-template-columns: 28px 1fr 80px;
          align-items: center;
          gap: 16px;
          padding: 12px 0;
          border-bottom: 1px solid var(--v3-hairline-soft);
        }
        :global([data-v3]) .v3-skeleton-row:last-child {
          border-bottom: 0;
        }
        :global([data-v3]) .v3-skeleton-logo {
          width: 24px;
          height: 24px;
          border-radius: var(--v3-r-pill);
          background: var(--v3-bg-2);
        }
        :global([data-v3]) .v3-skeleton-bar {
          height: 10px;
          border-radius: var(--v3-r-hairline);
          background: linear-gradient(
            90deg,
            var(--v3-bg-2) 0%,
            var(--v3-bg-3) 50%,
            var(--v3-bg-2) 100%
          );
          background-size: 200% 100%;
          animation: v3-shimmer 1.8s ease-in-out infinite;
        }
        :global([data-v3]) .v3-skeleton-pill {
          height: 16px;
          width: 60px;
          border-radius: var(--v3-r-pill);
          background: var(--v3-bg-2);
          justify-self: end;
        }
        @keyframes v3-shimmer {
          from {
            background-position: 100% 0;
          }
          to {
            background-position: -100% 0;
          }
        }
      `}</style>
    </WorkspaceShell>
  );
}
