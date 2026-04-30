/**
 * JSON-to-Markdown rendering for lighthouse skill outputs.
 *
 * PRD: gtm-conversational-canvas (T4)
 *
 * Each lighthouse skill validates its own output via Zod at the skill layer
 * (skills/<name>/schemas/output.ts). By the time output reaches this renderer
 * it has already been validated. So these renderers parse defensively (read
 * fields if present, skip cleanly if absent) without re-running Zod.
 *
 * Design constraints (from PRD):
 * - Idempotent: same JSON in → same MD out
 * - Skills folder will publish as its own GitHub repo (per CLAUDE.md), so we
 *   intentionally do NOT import from skills/<name>/schemas. We define local
 *   read-only shape interfaces and accept `unknown` at the boundary.
 * - Markdown only, no JSX/HTML — these strings are stored in
 *   gtm_artifacts.content_md and rendered by ArtifactCard at runtime.
 */

import type { LighthouseSkill } from "@/lib/gtm/types";

// ---------------------------------------------------------------------------
// Shared shapes (read-only, defensive — actual validation lives in skills/)
// ---------------------------------------------------------------------------

interface EvidenceCitation {
  value?: string;
  source_url?: string;
  retrieved_at?: string;
}

interface SourcedClaim {
  field_key?: string;
  label?: string;
  value?: unknown;
  confidence?: "high" | "medium" | "low" | string;
  evidence?: EvidenceCitation[];
  reason?: string;
}

interface SourceGap {
  field: string;
  reason?: string;
  remediation?: string;
  severity?: "info" | "warn" | "blocker" | string;
  confidence?: string;
}

interface DiscoveredPage {
  url: string;
  page_type?: string;
  title?: string;
  excerpt?: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function confidenceBadge(confidence?: string): string {
  if (!confidence) return "";
  const norm = confidence.toLowerCase();
  if (norm === "high") return " `high`";
  if (norm === "medium") return " `medium`";
  if (norm === "low") return " `low`";
  return ` \`${confidence}\``;
}

function severityBadge(severity?: string): string {
  if (!severity) return "";
  const norm = severity.toLowerCase();
  if (norm === "blocker") return " ⚠️";
  if (norm === "warn") return " ◇";
  return "";
}

function renderEvidence(evidence: EvidenceCitation[]): string {
  if (!evidence.length) return "";
  const lines = evidence
    .map((e) => {
      const url = asString(e.source_url);
      if (!url) return null;
      const label = asString(e.value, url);
      return `  - [${label}](${url})`;
    })
    .filter((line): line is string => line !== null);
  return lines.length ? `\n${lines.join("\n")}` : "";
}

function renderClaim(claim: SourcedClaim): string {
  const label = asString(claim.label, asString(claim.field_key, "Field"));
  const value =
    typeof claim.value === "string"
      ? claim.value
      : claim.value !== undefined
        ? JSON.stringify(claim.value)
        : "";
  const conf = confidenceBadge(claim.confidence);
  const reason = claim.reason ? `\n  > ${claim.reason}` : "";
  const evidence = renderEvidence(asArray<EvidenceCitation>(claim.evidence));
  return `- **${label}**${conf}\n  ${value}${reason}${evidence}`;
}

function renderGapList(gaps: SourceGap[]): string {
  if (!gaps.length) return "";
  const items = gaps.map((g) => {
    const sev = severityBadge(g.severity);
    const reason = g.reason ? ` — ${g.reason}` : "";
    const remediation = g.remediation ? `\n  > Fix: ${g.remediation}` : "";
    return `- \`${g.field}\`${sev}${reason}${remediation}`;
  });
  return `\n## Source gaps\n\n${items.join("\n")}\n`;
}

function renderPages(pages: DiscoveredPage[]): string {
  if (!pages.length) return "";
  const items = pages.map(
    (p) => `- ${p.page_type ? `\`${p.page_type}\` ` : ""}[${asString(p.title, p.url)}](${p.url})`,
  );
  return `\n## Discovered pages\n\n${items.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Per-skill renderers
// ---------------------------------------------------------------------------

function renderIngestUrl(out: Record<string, unknown>): string {
  const company = asString(out.company_name, "Unknown company");
  const url = asString(out.canonical_url, asString(out.input_url));
  const claims = asArray<SourcedClaim>(out.prefilled_fields);
  const gaps = asArray<SourceGap>(out.source_gaps);
  const pages = asArray<DiscoveredPage>(out.discovered_pages);

  const summary = `${claims.length} fields prefilled · ${pages.length} pages discovered · ${gaps.length} source gaps`;

  return [
    `# ${company} · URL ingest`,
    url ? `Source: <${url}>` : "",
    "",
    `**Summary** — ${summary}`,
    "",
    "## Prefilled fields",
    "",
    claims.map(renderClaim).join("\n\n"),
    renderPages(pages),
    renderGapList(gaps),
  ]
    .filter(Boolean)
    .join("\n");
}

function renderIngestIdentity(out: Record<string, unknown>): string {
  const company = asString(out.company_name, "Unknown company");
  const domain = asString(out.domain);
  const category = asString(out.category);
  const coreKw = asArray<string>(out.core_keywords);
  const negKw = asArray<string>(out.negative_keywords);
  const sources = asArray<{ url?: string; label?: string }>(out.sources);
  const gaps = asArray<SourceGap>(out.source_gaps);

  return [
    `# ${company} · Identity`,
    domain ? `Domain: \`${domain}\`` : "",
    category ? `Category: ${category}` : "",
    "",
    coreKw.length ? `**Core keywords:** ${coreKw.map((k) => `\`${k}\``).join(", ")}` : "",
    negKw.length ? `**Negative keywords:** ${negKw.map((k) => `\`${k}\``).join(", ")}` : "",
    sources.length
      ? `\n## Sources\n\n${sources
          .map((s) => `- [${asString(s.label, asString(s.url))}](${asString(s.url)})`)
          .join("\n")}`
      : "",
    renderGapList(gaps),
  ]
    .filter(Boolean)
    .join("\n");
}

function renderResearchIcp(out: Record<string, unknown>): string {
  const company = asString(out.company_name, "Unknown company");
  const personas = asArray<Record<string, unknown>>(out.persona_anchors);
  const stages = asArray<Record<string, unknown>>(out.awareness_stages);
  const titles = asArray<SourcedClaim>(out.job_titles);
  const intent = asObj(out.search_intent);
  const exclusions = asArray<string>(out.exclusions);
  const gaps = asArray<SourceGap>(out.source_gaps);

  const personaSection = personas.length
    ? `## Persona anchors\n\n${personas
        .map((p) => {
          const name = asString(p.name, asString(p.label, "Persona"));
          const desc = asString(p.description, asString(p.value));
          return `- **${name}** — ${desc}`;
        })
        .join("\n")}`
    : "";

  const stageSection = stages.length
    ? `\n## Awareness stages\n\n${stages
        .map((s) => `- **${asString(s.stage, asString(s.label))}** — ${asString(s.description)}`)
        .join("\n")}`
    : "";

  const titleSection = titles.length
    ? `\n## Job titles\n\n${titles.map(renderClaim).join("\n\n")}`
    : "";

  const intentSection =
    Object.keys(intent).length > 0
      ? `\n## Search intent\n\n\`\`\`json\n${JSON.stringify(intent, null, 2)}\n\`\`\``
      : "";

  const exclusionSection = exclusions.length
    ? `\n## Exclusions\n\n${exclusions.map((e) => `- ${e}`).join("\n")}`
    : "";

  return [
    `# ${company} · ICP`,
    "",
    personaSection,
    stageSection,
    titleSection,
    intentSection,
    exclusionSection,
    renderGapList(gaps),
  ]
    .filter(Boolean)
    .join("\n");
}

function renderResearchCompetitor(out: Record<string, unknown>): string {
  const competitors = asArray<Record<string, unknown>>(out.competitor_set);
  const positioning = asObj(out.positioning_taxonomy);
  const pricing = asObj(out.pricing_reality);
  const sov = asObj(out.share_of_voice);
  const reviewFeedback = asArray<Record<string, unknown>>(out.review_mined_feedback);
  const arc = asString(out.competitor_narrative_arc);
  const paidSocial = asArray<Record<string, unknown>>(out.paid_social_ad_inventory);
  const paidSearch = asArray<Record<string, unknown>>(out.paid_search_ad_inventory);
  const delta = asString(out.organic_vs_paid_narrative_delta);
  const gaps = asArray<SourceGap>(out.source_gaps);

  const compSection = competitors.length
    ? `## Competitor set\n\n${competitors
        .map((c) => {
          const name = asString(c.name);
          const domain = asString(c.domain);
          return `- **${name}**${domain ? ` — \`${domain}\`` : ""}`;
        })
        .join("\n")}`
    : "";

  const adInventory =
    paidSocial.length || paidSearch.length
      ? `\n## Ad activity\n\n- Paid social ads tracked: ${paidSocial.length}\n- Paid search ads tracked: ${paidSearch.length}`
      : "";

  return [
    `# Competitor landscape`,
    "",
    compSection,
    Object.keys(positioning).length
      ? `\n## Positioning taxonomy\n\n\`\`\`json\n${JSON.stringify(positioning, null, 2)}\n\`\`\``
      : "",
    Object.keys(pricing).length
      ? `\n## Pricing reality\n\n\`\`\`json\n${JSON.stringify(pricing, null, 2)}\n\`\`\``
      : "",
    Object.keys(sov).length
      ? `\n## Share of voice\n\n\`\`\`json\n${JSON.stringify(sov, null, 2)}\n\`\`\``
      : "",
    reviewFeedback.length ? `\n## Review-mined feedback\n\n${reviewFeedback.length} entries` : "",
    arc ? `\n## Competitor narrative arc\n\n${arc}` : "",
    adInventory,
    delta ? `\n## Organic vs paid narrative delta\n\n${delta}` : "",
    renderGapList(gaps),
  ]
    .filter(Boolean)
    .join("\n");
}

function renderResearchMarket(out: Record<string, unknown>): string {
  const company = asString(out.source_company_name, "Unknown company");
  const summary = asString(out.summary);
  const keyFindings = asArray<string>(out.keyFindings);
  const assumptions = asArray<string>(out.assumptions);
  const marketScope = asObj(out.market_scope);
  const catDef = asObj(out.category_definition);
  const sizeSignals = asArray<Record<string, unknown>>(out.market_size_signals);
  const maturity = asObj(out.category_maturity);
  const timing = asArray<Record<string, unknown>>(out.timing_signals);
  const demandDrivers = asArray<SourcedClaim>(out.demand_drivers);
  const buyingTriggers = asArray<SourcedClaim>(out.buying_triggers);
  const barriers = asArray<SourcedClaim>(out.adoption_barriers);
  const opportunities = asArray<Record<string, unknown>>(out.opportunity_candidates);
  const gaps = asArray<SourceGap>(out.source_gaps);

  return [
    `# ${company} · Market`,
    "",
    summary ? `**Summary** — ${summary}` : "",
    keyFindings.length
      ? `\n## Key findings\n\n${keyFindings.map((f) => `- ${f}`).join("\n")}`
      : "",
    Object.keys(marketScope).length
      ? `\n## Market scope\n\n\`\`\`json\n${JSON.stringify(marketScope, null, 2)}\n\`\`\``
      : "",
    Object.keys(catDef).length
      ? `\n## Category definition\n\n\`\`\`json\n${JSON.stringify(catDef, null, 2)}\n\`\`\``
      : "",
    sizeSignals.length
      ? `\n## Market size signals\n\n${sizeSignals.length} signal(s) collected`
      : "",
    Object.keys(maturity).length
      ? `\n## Category maturity\n\n\`\`\`json\n${JSON.stringify(maturity, null, 2)}\n\`\`\``
      : "",
    timing.length ? `\n## Timing signals\n\n${timing.length} signal(s) collected` : "",
    demandDrivers.length
      ? `\n## Demand drivers\n\n${demandDrivers.map(renderClaim).join("\n\n")}`
      : "",
    buyingTriggers.length
      ? `\n## Buying triggers\n\n${buyingTriggers.map(renderClaim).join("\n\n")}`
      : "",
    barriers.length
      ? `\n## Adoption barriers\n\n${barriers.map(renderClaim).join("\n\n")}`
      : "",
    opportunities.length
      ? `\n## Opportunity candidates\n\n${opportunities.length} candidate(s)`
      : "",
    assumptions.length
      ? `\n## Assumptions\n\n${assumptions.map((a) => `- ${a}`).join("\n")}`
      : "",
    renderGapList(gaps),
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const RENDERERS: Record<LighthouseSkill, (out: Record<string, unknown>) => string> = {
  "ingest-url": renderIngestUrl,
  "ingest-identity": renderIngestIdentity,
  "research-icp": renderResearchIcp,
  "research-competitor": renderResearchCompetitor,
  "research-market": renderResearchMarket,
};

export function renderSkillOutputToMd(
  skill: LighthouseSkill,
  output: unknown,
): string {
  const renderer = RENDERERS[skill];
  if (!renderer) {
    throw new Error(`renderSkillOutputToMd: unknown skill "${skill}"`);
  }
  return renderer(asObj(output)).trim() + "\n";
}
