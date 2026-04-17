"use client";

import { useState } from "react";
import { WorkspaceShell } from "@/components/workspace-v3/workspace-shell";
import { StatusStrip } from "@/components/workspace-v3/status-strip";
import type { CommandAction } from "@/components/workspace-v3/command-menu";

/**
 * Preview route for the journey-workspace-v3 redesign.
 *
 * Phase 2a: shell primitives (top bar, peek rail, canvas, chat chip)
 * Phase 2b: command menu (⌘K), chat panel (⌘;), view modes (V)
 *
 * Compare against the production shell at /journey.
 */
export default function JourneyV3PreviewPage() {
  const [currentSection, setCurrentSection] = useState("research");

  const crumbs = [
    { label: "Nike Direct", dim: true },
    { label: "Industry Research" },
  ];

  const peekGroups = [
    {
      label: "Journey",
      items: [
        { label: "Onboarding", onClick: () => setCurrentSection("onboarding") },
        {
          label: "Research",
          active: currentSection === "research",
          onClick: () => setCurrentSection("research"),
        },
        {
          label: "Media Plan",
          onClick: () => setCurrentSection("media-plan"),
        },
        { label: "Scripts", onClick: () => setCurrentSection("scripts") },
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

  const navigateActions: CommandAction[] = [
    {
      id: "go-onboarding",
      group: "Navigate",
      label: "Onboarding",
      onSelect: () => setCurrentSection("onboarding"),
    },
    {
      id: "go-research",
      group: "Navigate",
      label: "Research",
      onSelect: () => setCurrentSection("research"),
    },
    {
      id: "go-media-plan",
      group: "Navigate",
      label: "Media Plan",
      onSelect: () => setCurrentSection("media-plan"),
    },
    {
      id: "approve-all",
      group: "Actions",
      label: "Approve all completed sections",
      onSelect: () => alert("approve-all (stub)"),
    },
    {
      id: "generate-plan",
      group: "Actions",
      label: "Generate media plan →",
      disabled: true,
      onSelect: () => alert("generate (stub)"),
    },
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
      commandActions={navigateActions}
    >
      <div className="v3-verbose-only v3-agent-board">
        <div className="v3-mono-label" style={{ marginBottom: 10 }}>
          Agent board · verbose mode
        </div>
        <div className="v3-agent-grid">
          {[
            { name: "industryMarket", state: "done" },
            { name: "competitors", state: "running" },
            { name: "icpValidation", state: "running" },
            { name: "offerAnalysis", state: "running" },
            { name: "keywordIntel", state: "queued" },
            { name: "crossAnalysis", state: "queued" },
          ].map((a) => (
            <div key={a.name} className={`v3-agent-cell v3-agent-${a.state}`}>
              <div className="v3-mono-xs">{a.name}</div>
              <div className="v3-tertiary">{a.state}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 32,
        }}
      >
        <h1 className="v3-display">Research</h1>
        <span className="v3-mono-label">2 of 8 complete</span>
      </div>

      <section className="v3-card">
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

      <section className="v3-card">
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

      <section className="v3-card v3-card-queued">
        <div className="v3-card-head">
          <span className="v3-dot v3-dot-idle" aria-hidden="true" />
          <h2 className="v3-card-title">ICP Validation</h2>
          <span className="v3-card-meta">queued</span>
        </div>
      </section>
    </WorkspaceShell>
  );
}
