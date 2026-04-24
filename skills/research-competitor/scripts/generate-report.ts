/**
 * Research Competitor — Standalone HTML Report Generator
 *
 * Renders output.json into a self-contained editorial-style HTML report.
 * Zero runtime deps. Fonts loaded via Google Fonts link tag.
 *
 * Aesthetic: editorial / newsprint. Fraunces display + IBM Plex Sans body +
 * IBM Plex Mono data. Warm paper ground, near-black ink, crimson accent.
 *
 * Usage:
 *   npx tsx scripts/generate-report.ts <output.json> [report.html]
 */
import * as fs from "fs";

// ── primitives ───────────────────────────────────────────────────────────

function esc(str: unknown): string {
  if (str == null) return "";
  const s = typeof str === "string" ? str : JSON.stringify(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function link(href: string | undefined, text?: string): string {
  if (!href) return "";
  const display = text ?? shortUrl(href);
  return `<a href="${esc(href)}" target="_blank" rel="noreferrer noopener">${esc(
    display,
  )}</a>`;
}

function shortUrl(href: string): string {
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return href;
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── types ────────────────────────────────────────────────────────────────

type Any = Record<string, unknown>;

interface Ad {
  name: string;
  active_ad_count: number;
  run_duration_range: string;
  formats: string[];
  hook_strings_verbatim: string[];
  cta_patterns: string[];
  ad_library_url: string;
  source_url: string;
  retrieved_at: string;
}
interface Signal {
  name: string;
  always_on_vs_burst: "always_on" | "burst" | "mixed" | "unknown";
  refresh_cadence_days: number;
  geo_targeting_visible: string[];
  source_url?: string;
  retrieved_at?: string;
}

// ── section: header + masthead ───────────────────────────────────────────

function renderMasthead(data: Any): string {
  const company = esc((data.source_company_name as string) ?? "Target");
  const runId = esc((data.run_id as string) ?? "unknown");
  const genAt = formatDate((data.generated_at as string) ?? new Date().toISOString());

  return `
  <header class="masthead">
    <div class="masthead-rule"></div>
    <div class="masthead-meta">
      <span class="eyebrow">Competitor Landscape &amp; Positioning</span>
      <span class="run-id">Run · <code>${runId}</code></span>
      <span class="dateline">${genAt}</span>
    </div>
    <h1 class="title">${company}</h1>
    <div class="subtitle">A factual brief of the competitive field — verbatim
      positioning, observed pricing, live ad activity, and user-voiced reviews.
      Every claim carries a source.</div>
  </header>`;
}

// ── section: executive summary ──────────────────────────────────────────

function renderExecSummary(data: Any): string {
  const cs = (data.competitor_set as Any[]) ?? [];
  const pr = (data.pricing_reality as Any[]) ?? [];
  const ads = (data.paid_social_ad_inventory as Ad[]) ?? [];
  const sigs = (data.ad_activity_signals as Signal[]) ?? [];
  const reviews = (data.review_mined_feedback as Any[]) ?? [];

  const countByType = (t: string) =>
    cs.filter((c) => c.type === t).length;

  const activelyAdvertising = ads.filter((a) => (a.active_ad_count ?? 0) > 0).length;
  const alwaysOn = sigs.filter((s) => s.always_on_vs_burst === "always_on").length;

  const allPrices = pr
    .flatMap((p) => (p.public_prices as string[]) ?? [])
    .map((s) => {
      const m = s.match(/\$\s?(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : null;
    })
    .filter((n): n is number => n !== null && n > 0);

  const minP = allPrices.length ? Math.min(...allPrices) : null;
  const maxP = allPrices.length ? Math.max(...allPrices) : null;

  const stats = [
    { k: "Competitors", v: String(cs.length), sub: `${countByType("direct")} direct · ${countByType("indirect")} indirect · ${countByType("status_quo")} status-quo` },
    { k: "Active platform pulls", v: `${activelyAdvertising}/${ads.length || cs.length}`, sub: `${alwaysOn} always-on · ${sigs.filter((s) => s.always_on_vs_burst === "burst").length} burst` },
    { k: "Price range", v: minP != null && maxP != null ? `$${minP}–$${maxP}` : "—", sub: "lowest public tier to highest observed" },
    { k: "Voice captured", v: `${reviews.length}`, sub: `${reviews.filter((r) => r.polarity === "positive").length} pos · ${reviews.filter((r) => r.polarity === "negative").length} neg · ${reviews.filter((r) => r.polarity === "mixed").length} mixed` },
  ];

  return `
  <section class="exec-summary" id="top">
    <div class="exec-stats">
      ${stats
        .map(
          (s) => `
        <div class="stat">
          <div class="stat-value">${esc(s.v)}</div>
          <div class="stat-key">${esc(s.k)}</div>
          <div class="stat-sub">${esc(s.sub)}</div>
        </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

// ── section: TOC ────────────────────────────────────────────────────────

function renderTOC(): string {
  const items = [
    ["Matrix", "#matrix"],
    ["Positioning", "#positioning"],
    ["Pricing", "#pricing"],
    ["Paid Ads", "#ads"],
    ["Reviews", "#reviews"],
    ["Narrative Arc", "#narrative"],
    ["Share of Voice", "#sov"],
  ];
  return `
  <nav class="toc" aria-label="Table of contents">
    ${items.map(([t, h]) => `<a href="${h}">${esc(t)}</a>`).join("")}
  </nav>`;
}

// ── helper: split "Name · Platform" suffix ─────────────────────────────

function parsePlatformName(combined: string): { base: string; platform: string | null } {
  const idx = combined.lastIndexOf(" · ");
  if (idx === -1) return { base: combined, platform: null };
  const platform = combined.slice(idx + 3).trim();
  const base = combined.slice(0, idx).trim();
  const known = new Set(["Meta", "LinkedIn", "Google"]);
  return known.has(platform) ? { base, platform } : { base: combined, platform: null };
}

interface AggregatedAd {
  base: string;
  total: number;
  byPlatform: Map<string, { count: number; cadence?: Signal["always_on_vs_burst"]; refresh?: number }>;
  platformEntries: Array<{ platform: string; inv: Ad; sig?: Signal }>;
  ranges: string[];
  cadences: Array<Signal["always_on_vs_burst"]>;
  formats: string[];
}

function aggregateAds(
  ads: Ad[],
  sigs: Signal[],
): Map<string, AggregatedAd> {
  const byBase = new Map<string, AggregatedAd>();
  for (const inv of ads) {
    const { base, platform } = parsePlatformName(inv.name);
    const sig = sigs.find((s) => s.name === inv.name);
    if (!byBase.has(base)) {
      byBase.set(base, {
        base,
        total: 0,
        byPlatform: new Map(),
        platformEntries: [],
        ranges: [],
        cadences: [],
        formats: [],
      });
    }
    const agg = byBase.get(base)!;
    agg.total += inv.active_ad_count ?? 0;
    if (platform) {
      agg.byPlatform.set(platform, {
        count: inv.active_ad_count ?? 0,
        cadence: sig?.always_on_vs_burst,
        refresh: sig?.refresh_cadence_days,
      });
    }
    agg.platformEntries.push({ platform: platform ?? "—", inv, sig });
    if (inv.run_duration_range && inv.run_duration_range !== "unavailable") {
      agg.ranges.push(inv.run_duration_range);
    }
    if (sig?.always_on_vs_burst) agg.cadences.push(sig.always_on_vs_burst);
    agg.formats.push(...(inv.formats ?? []));
  }
  return byBase;
}

function rollupCadence(cadences: Array<Signal["always_on_vs_burst"]>): Signal["always_on_vs_burst"] {
  if (cadences.includes("always_on")) return "always_on";
  if (cadences.includes("mixed")) return "mixed";
  if (cadences.includes("burst")) return "burst";
  return "unknown";
}

// ── section: comparison matrix ──────────────────────────────────────────

function renderMatrix(data: Any): string {
  const cs = (data.competitor_set as Any[]) ?? [];
  const pt = (data.positioning_taxonomy as Any[]) ?? [];
  const pr = (data.pricing_reality as Any[]) ?? [];
  const ads = (data.paid_social_ad_inventory as Ad[]) ?? [];
  const sigs = (data.ad_activity_signals as Signal[]) ?? [];
  const reviews = (data.review_mined_feedback as Any[]) ?? [];
  const aggregated = aggregateAds(ads, sigs);

  const byName = (arr: ReadonlyArray<{ name?: unknown }>, n: string) =>
    arr.find((x) => x.name === n) as Any | undefined;

  const rows = cs.map((c) => {
    const name = c.name as string;
    const p = byName(pt, name);
    const price = byName(pr, name);
    const agg = aggregated.get(name);
    const revs = reviews.filter((r) => r.name === name);

    const firstPrice = ((price?.public_prices as string[] | undefined) ?? [])[1] ?? ((price?.public_prices as string[] | undefined) ?? [])[0] ?? "—";
    const solution = (p?.solution_framing_verbatim as string) ?? "—";
    const tagline = solution.split(/[.!]/)[0].slice(0, 120) + (solution.length > 120 ? "…" : "");

    const rolled = agg ? rollupCadence(agg.cadences) : "unknown";
    const cadenceTag =
      rolled === "always_on" ? `<span class="tag tag-on">always-on</span>`
      : rolled === "burst" ? `<span class="tag tag-burst">burst</span>`
      : rolled === "mixed" ? `<span class="tag tag-mixed">mixed</span>`
      : `<span class="tag tag-unknown">—</span>`;

    const totalAds = agg?.total ?? 0;

    const platformBreakdown = agg && agg.byPlatform.size
      ? [...agg.byPlatform.entries()]
        .filter(([, v]) => v.count > 0)
        .map(([p, v]) => `<span class="plat-pill">${esc(p[0])}${v.count}</span>`)
        .join("")
      : "";

    const pos = revs.filter((r) => r.polarity === "positive").length;
    const neg = revs.filter((r) => r.polarity === "negative").length;

    return `
    <tr>
      <td class="col-name">
        <a href="#c-${slug(name)}" class="comp-link">${esc(name)}</a>
        <div class="comp-type">${esc(c.type as string ?? "")}</div>
      </td>
      <td class="col-tag">${esc(tagline)}</td>
      <td class="col-price">${esc(firstPrice)}</td>
      <td class="col-ads">
        <span class="numeral ${totalAds ? "lit" : "dim"}">${totalAds}</span>
        ${cadenceTag}
        <div class="plat-pills">${platformBreakdown}</div>
      </td>
      <td class="col-reviews">
        <span class="rev-pos">+${pos}</span>
        <span class="rev-neg">−${neg}</span>
      </td>
    </tr>`;
  }).join("");

  return `
  <section class="section" id="matrix">
    <div class="section-head">
      <span class="section-num">01</span>
      <h2 class="section-title">The Field at a Glance</h2>
      <p class="section-lede">One row per competitor. Tagline is the first sentence of their solution framing. Price is the entry paid tier. Ads are live platform counts from SearchAPI-backed ad libraries.</p>
    </div>
    <table class="matrix">
      <thead>
        <tr>
          <th>Competitor</th>
          <th>Tagline</th>
          <th>Entry price</th>
          <th>Active ads</th>
          <th>Voice</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// ── section: positioning ────────────────────────────────────────────────

function renderPositioning(data: Any): string {
  const pt = (data.positioning_taxonomy as Any[]) ?? [];
  if (!pt.length) return "";
  const cards = pt
    .map((p) => {
      const name = p.name as string;
      return `
      <article class="pos-card" id="c-${slug(name)}">
        <header class="pos-head">
          <h3>${esc(name)}</h3>
          <a class="src" href="${esc(p.source_url as string)}" target="_blank" rel="noreferrer">${esc(shortUrl((p.source_url as string) ?? ""))}</a>
        </header>
        <div class="pos-body">
          <div>
            <div class="label">Problem framing</div>
            <blockquote>${esc(p.problem_framing_verbatim as string)}</blockquote>
          </div>
          <div>
            <div class="label">Solution framing</div>
            <blockquote class="emph">${esc(p.solution_framing_verbatim as string)}</blockquote>
          </div>
        </div>
      </article>`;
    })
    .join("");

  return `
  <section class="section" id="positioning">
    <div class="section-head">
      <span class="section-num">02</span>
      <h2 class="section-title">How They Frame It</h2>
      <p class="section-lede">Verbatim problem- and solution-framing, captured from each competitor's own homepage copy.</p>
    </div>
    <div class="pos-grid">${cards}</div>
  </section>`;
}

// ── section: pricing ────────────────────────────────────────────────────

function renderPricing(data: Any): string {
  const pr = (data.pricing_reality as Any[]) ?? [];
  if (!pr.length) return "";
  const cards = pr
    .map((p) => {
      const name = p.name as string;
      const prices = ((p.public_prices as string[]) ?? []).map(
        (t) => `<li class="tier">${esc(t)}</li>`,
      ).join("");
      const gated = ((p.gated_pricing_signals as string[]) ?? []).map(
        (g) => `<li class="gated">${esc(g)}</li>`,
      ).join("");
      return `
      <article class="price-card">
        <header>
          <h3>${esc(name)}</h3>
          <a class="src" href="${esc(p.source_url as string)}" target="_blank" rel="noreferrer">${esc(shortUrl((p.source_url as string) ?? ""))}</a>
        </header>
        <div class="label">Public tiers</div>
        <ul class="tier-list">${prices || `<li class="muted">no public tiers</li>`}</ul>
        ${gated ? `<div class="label">Gated signals</div><ul class="gate-list">${gated}</ul>` : ""}
        ${p.packaging_notes ? `<div class="label">Packaging</div><p class="packaging">${esc(p.packaging_notes as string)}</p>` : ""}
      </article>`;
    })
    .join("");
  return `
  <section class="section" id="pricing">
    <div class="section-head">
      <span class="section-num">03</span>
      <h2 class="section-title">What They Charge</h2>
      <p class="section-lede">Exact tier names and prices from public pricing pages. "Contact sales" signals and packaging observations noted factually, without judgment.</p>
    </div>
    <div class="price-grid">${cards}</div>
  </section>`;
}

// ── section: paid social ads (the real showcase) ───────────────────────

function renderAdsInventory(data: Any): string {
  const ads = (data.paid_social_ad_inventory as Ad[]) ?? [];
  const sigs = (data.ad_activity_signals as Signal[]) ?? [];
  if (!ads.length) return "";

  const aggregated = aggregateAds(ads, sigs);
  const sortedBases = [...aggregated.values()].sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(1, ...sortedBases.map((a) => a.total));

  // Bar chart: one bar per competitor, aggregated across platforms, with stacked segments per platform
  const bars = sortedBases.map((agg) => {
    const metaC = agg.byPlatform.get("Meta")?.count ?? 0;
    const linkedC = agg.byPlatform.get("LinkedIn")?.count ?? 0;
    const googC = agg.byPlatform.get("Google")?.count ?? 0;
    const total = agg.total;
    const pct = Math.round((total / maxTotal) * 100);
    const metaPct = total ? Math.round((metaC / total) * pct) : 0;
    const linkedPct = total ? Math.round((linkedC / total) * pct) : 0;
    const googPct = Math.max(0, pct - metaPct - linkedPct);
    return `
      <div class="bar-row">
        <span class="bar-name">${esc(agg.base)}</span>
        <div class="bar-track">
          <div class="bar-seg seg-meta" style="width:${metaPct}%" title="Meta · ${metaC}"></div>
          <div class="bar-seg seg-linked" style="width:${linkedPct}%" title="LinkedIn · ${linkedC}"></div>
          <div class="bar-seg seg-goog" style="width:${googPct}%" title="Google · ${googC}"></div>
        </div>
        <span class="bar-count">${total}</span>
      </div>`;
  }).join("");

  // One poster per competitor, grouped. Platform sub-panels inside.
  const posters = sortedBases.map((agg) => {
    const empty = agg.total === 0;
    const rolled = rollupCadence(agg.cadences);
    const cadenceTag =
      rolled === "always_on" ? { cls: "tag-on", label: "Always-on" }
      : rolled === "burst" ? { cls: "tag-burst", label: "Burst" }
      : rolled === "mixed" ? { cls: "tag-mixed", label: "Mixed" }
      : { cls: "tag-unknown", label: "Unknown" };

    // Show platform sub-panels with per-platform hooks + counts
    const platforms = agg.platformEntries
      .sort((a, b) => (b.inv.active_ad_count ?? 0) - (a.inv.active_ad_count ?? 0));

    const platBlocks = platforms.map((pe) => {
      const n = pe.inv.active_ad_count ?? 0;
      const dim = n === 0;
      const hooks = (pe.inv.hook_strings_verbatim ?? []).slice(0, 3);
      return `
        <div class="plat-block ${dim ? "plat-dim" : ""}">
          <div class="plat-head">
            <span class="plat-label plat-${pe.platform.toLowerCase()}">${esc(pe.platform)}</span>
            <span class="plat-count ${dim ? "dim" : "lit"}">${n}</span>
          </div>
          ${hooks.length ? `<ol class="hook-list compact">
            ${hooks.map((h) => `<li class="hook">${esc(h)}</li>`).join("")}
          </ol>` : `<p class="muted small">${n > 0 ? "hooks unavailable" : `no ads on ${esc(pe.platform)}`}</p>`}
          <a class="plat-src" href="${esc(pe.inv.ad_library_url)}" target="_blank" rel="noreferrer">${esc(pe.platform)} Ad Library ↗</a>
        </div>`;
    }).join("");

    const allFormats = dedupStr(agg.formats);
    const range = agg.ranges.length
      ? agg.ranges.sort()[0] + (agg.ranges.length > 1 ? ` · +${agg.ranges.length - 1} platforms` : "")
      : "range unavailable";

    return `
    <article class="poster ${empty ? "poster-empty" : ""}">
      <header class="poster-head">
        <div>
          <h3 class="poster-name">${esc(agg.base)}</h3>
          <div class="poster-sub">${esc(range)}</div>
        </div>
        <div class="poster-count">
          <span class="numeral big ${empty ? "dim" : "lit"}">${agg.total}</span>
          <span class="numeral-label">total active ads</span>
        </div>
      </header>

      <div class="poster-meta">
        <span class="tag ${cadenceTag.cls}">${esc(cadenceTag.label)}</span>
        ${allFormats.map((f) => `<span class="tag tag-format">${esc(f)}</span>`).join("")}
      </div>

      <div class="plat-grid">${platBlocks}</div>
    </article>`;
  }).join("");

  return `
  <section class="section" id="ads">
    <div class="section-head">
      <span class="section-num">04</span>
      <h2 class="section-title">Who's Actually Spending</h2>
      <p class="section-lede">Live ad activity from Meta Ad Library, LinkedIn Ad Library, and Google Ads Transparency Center via SearchAPI. A zero means no advertiser match was found for that platform + name combination — not that the company doesn't advertise. Hook strings are verbatim from the ad creative.</p>
    </div>

    <div class="bar-chart">
      <div class="label">Active ad count by platform</div>
      <div class="bar-legend">
        <span class="leg-meta">Meta</span>
        <span class="leg-linked">LinkedIn</span>
        <span class="leg-goog">Google</span>
      </div>
      ${bars}
    </div>

    <div class="poster-grid">${posters}</div>
  </section>`;
}

function dedupStr(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

// ── section: reviews ────────────────────────────────────────────────────

function renderReviews(data: Any): string {
  const rf = (data.review_mined_feedback as Any[]) ?? [];
  if (!rf.length) return "";
  const cards = rf.map((r) => {
    const pol = r.polarity as string;
    const clr =
      pol === "positive" ? "review-pos" : pol === "negative" ? "review-neg" : "review-mix";
    return `
    <article class="review ${clr}">
      <div class="review-head">
        <strong>${esc(r.name as string)}</strong>
        <span class="tag tag-neutral">${esc(r.source_site as string)}</span>
        <span class="tag tag-${pol}">${esc(pol)}</span>
        ${r.review_date ? `<span class="src-time">${esc(r.review_date as string)}</span>` : ""}
      </div>
      <blockquote>${esc(r.verbatim_quote as string)}</blockquote>
      ${r.source_url ? `<a class="src small" href="${esc(r.source_url as string)}" target="_blank" rel="noreferrer">${esc(shortUrl(r.source_url as string))}</a>` : ""}
    </article>`;
  }).join("");

  return `
  <section class="section" id="reviews">
    <div class="section-head">
      <span class="section-num">05</span>
      <h2 class="section-title">In Their Users' Words</h2>
      <p class="section-lede">Verbatim review quotes, polarity determined by star rating or review tone — not by this report.</p>
    </div>
    <div class="review-grid">${cards}</div>
  </section>`;
}

// ── section: narrative arc ──────────────────────────────────────────────

function renderNarrative(data: Any): string {
  const na = (data.competitor_narrative_arc as Any[]) ?? [];
  if (!na.length) return "";
  const cards = na.map((n) => `
    <article class="arc">
      <header><h3>${esc(n.name as string)}</h3></header>
      <div class="arc-grid">
        <div class="arc-cell arc-villain"><div class="label">Villain</div><p>${esc(n.villain as string)}</p></div>
        <div class="arc-cell arc-hero"><div class="label">Hero</div><p>${esc(n.hero as string)}</p></div>
        <div class="arc-cell arc-trans"><div class="label">Transformation</div><p>${esc(n.transformation_claim as string)}</p></div>
      </div>
      <blockquote class="arc-evidence">${esc(n.evidence_verbatim as string)}</blockquote>
      <a class="src small" href="${esc(n.source_url as string)}" target="_blank" rel="noreferrer">${esc(shortUrl((n.source_url as string) ?? ""))}</a>
    </article>`).join("");
  return `
  <section class="section" id="narrative">
    <div class="section-head">
      <span class="section-num">06</span>
      <h2 class="section-title">Villain · Hero · Transformation</h2>
      <p class="section-lede">The narrative arc each competitor constructs for themselves, pulled from their own copy.</p>
    </div>
    <div class="arc-wrap">${cards}</div>
  </section>`;
}

// ── section: share of voice ────────────────────────────────────────────

function renderShareOfVoice(data: Any): string {
  const sov = (data.share_of_voice as Any) ?? {};
  const terms = (sov.search_terms_owned as string[]) ?? [];
  const comms = (sov.communities_owned as Array<Any>) ?? [];
  const pubs = (sov.publications_owned as Array<Any>) ?? [];
  const evidence = (sov.evidence_per_claim as Array<Any>) ?? [];
  if (!terms.length && !comms.length && !pubs.length && !evidence.length) return "";

  return `
  <section class="section" id="sov">
    <div class="section-head">
      <span class="section-num">07</span>
      <h2 class="section-title">Share of Voice</h2>
      <p class="section-lede">Where the category is actually discussed — organic terms, communities, and publications with evidence.</p>
    </div>
    <div class="sov-grid">
      <div>
        <div class="label">Search terms owned</div>
        <ul class="chip-list">${terms.map((t) => `<li class="chip">${esc(t)}</li>`).join("")}</ul>
      </div>
      <div>
        <div class="label">Communities</div>
        <ul class="src-list">${comms.map((c) => `<li>${c.url ? link(c.url as string, c.name as string) : esc(c.name as string)}${c.evidence ? `<div class="muted small">${esc(c.evidence as string)}</div>` : ""}</li>`).join("")}</ul>
      </div>
      <div>
        <div class="label">Publications</div>
        <ul class="src-list">${pubs.map((p) => `<li>${p.url ? link(p.url as string, p.name as string) : esc(p.name as string)}${p.evidence ? `<div class="muted small">${esc(p.evidence as string)}</div>` : ""}</li>`).join("")}</ul>
      </div>
    </div>
    ${evidence.length ? `
    <div class="evidence-block">
      <div class="label">Evidence per claim</div>
      <ul>${evidence.map((e) => `<li>${esc(e.claim as string)} — ${link(e.evidence_url as string)}</li>`).join("")}</ul>
    </div>` : ""}
  </section>`;
}

// ── footer ──────────────────────────────────────────────────────────────

function renderFooter(data: Any): string {
  const calls = ((data.tool_calls_used as string[]) ?? []).join(" · ");
  return `
  <footer class="colophon">
    <div class="colophon-rule"></div>
    <div class="colophon-body">
      <div>
        <div class="label">Method</div>
        <p>Collected by an LLM agent using <code>web_search</code> + <code>WebFetch</code>. Ads via SearchAPI → Meta Ad Library. Schema-validated by Zod. Facts only — no LLM-scored metrics, no recommendations.</p>
      </div>
      <div>
        <div class="label">Tools used</div>
        <p class="mono">${esc(calls || "—")}</p>
      </div>
      <div>
        <div class="label">Run</div>
        <p class="mono">${esc((data.run_id as string) ?? "—")}</p>
      </div>
    </div>
    <div class="colophon-meta">Research Competitor · Section 03 · <a href="#top">back to top ↑</a></div>
  </footer>`;
}

// ── main build ─────────────────────────────────────────────────────────

export function buildReport(data: Any): string {
  const company = esc((data.source_company_name as string) ?? "Target");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${company} — Competitor Landscape</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,900&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
  ${renderMasthead(data)}
  ${renderExecSummary(data)}
  ${renderTOC()}
  <main class="prose">
    ${renderMatrix(data)}
    ${renderPositioning(data)}
    ${renderPricing(data)}
    ${renderAdsInventory(data)}
    ${renderReviews(data)}
    ${renderNarrative(data)}
    ${renderShareOfVoice(data)}
  </main>
  ${renderFooter(data)}
</body>
</html>`;
}

// ── CSS — editorial / newsprint ────────────────────────────────────────

const CSS = `
:root {
  --paper: #faf8f2;
  --paper-2: #f3efe4;
  --ink: #1a1a1a;
  --ink-2: #2a2a2a;
  --muted: #757267;
  --rule: #d9d3c2;
  --accent: #a6172a;
  --accent-soft: #fdecef;
  --pos: #14532d;
  --pos-soft: #e4efe5;
  --neg: #7a1717;
  --neg-soft: #f4e1e1;
  --warn: #8a5a00;
  --warn-soft: #f5e9d0;
  --serif: "Fraunces", "Iowan Old Style", Georgia, serif;
  --sans:  "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --mono:  "IBM Plex Mono", ui-monospace, "SF Mono", monospace;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  padding: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.65;
  font-feature-settings: "ss01", "cv11", "tnum";
  -webkit-font-smoothing: antialiased;
}

/* ── masthead ─────────────────────────────────── */
.masthead {
  max-width: 1120px;
  margin: 0 auto;
  padding: 56px 40px 16px;
  position: relative;
}
.masthead-rule {
  height: 8px;
  background: var(--ink);
  margin-bottom: 28px;
  position: relative;
}
.masthead-rule::after {
  content: "";
  position: absolute;
  right: 0; top: 0;
  width: 30%;
  height: 100%;
  background: var(--accent);
}
.masthead-meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  padding-bottom: 16px;
  border-bottom: 1px solid var(--rule);
}
.masthead-meta code { font-family: var(--mono); color: var(--ink-2); }
.eyebrow { color: var(--accent); font-weight: 600; }
.title {
  font-family: var(--serif);
  font-variation-settings: "opsz" 144, "wght" 700;
  font-size: clamp(48px, 8vw, 104px);
  line-height: 0.95;
  letter-spacing: -0.02em;
  margin: 28px 0 16px;
}
.subtitle {
  font-family: var(--serif);
  font-variation-settings: "opsz" 24, "wght" 400;
  font-size: 19px;
  line-height: 1.5;
  max-width: 680px;
  color: var(--ink-2);
  margin: 0 0 20px;
}

/* ── exec summary ─────────────────────────────── */
.exec-summary {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px 40px 8px;
}
.exec-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--rule);
  border: 1px solid var(--rule);
}
.stat {
  background: var(--paper);
  padding: 22px 20px;
}
.stat-value {
  font-family: var(--serif);
  font-variation-settings: "opsz" 72, "wght" 500;
  font-size: 40px;
  line-height: 1;
  letter-spacing: -0.015em;
  color: var(--ink);
  margin-bottom: 6px;
  font-variant-numeric: tabular-nums;
}
.stat-key {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  margin-bottom: 4px;
}
.stat-sub {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.35;
}
@media (max-width: 780px) {
  .exec-stats { grid-template-columns: repeat(2, 1fr); }
}

/* ── TOC ──────────────────────────────────────── */
.toc {
  max-width: 1120px;
  margin: 32px auto 0;
  padding: 14px 40px;
  display: flex;
  gap: 0;
  flex-wrap: wrap;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  position: sticky;
  top: 0;
  background: var(--paper);
  z-index: 10;
  font-family: var(--mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.toc a {
  color: var(--ink-2);
  text-decoration: none;
  padding: 4px 16px 4px 0;
  margin-right: 12px;
  border-right: 1px solid var(--rule);
  transition: color .15s;
}
.toc a:last-child { border-right: 0; }
.toc a:hover { color: var(--accent); }

/* ── prose base ───────────────────────────────── */
.prose {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 40px 80px;
}
.section {
  margin: 80px 0 0;
  scroll-margin-top: 80px;
}
.section-head {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 8px 24px;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--rule);
}
.section-num {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  padding-top: 14px;
  grid-row: 1 / span 2;
  letter-spacing: 0.08em;
}
.section-title {
  font-family: var(--serif);
  font-variation-settings: "opsz" 96, "wght" 600;
  font-size: clamp(30px, 4vw, 44px);
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 0;
}
.section-lede {
  font-family: var(--serif);
  font-variation-settings: "opsz" 20, "wght" 400;
  font-size: 17px;
  line-height: 1.5;
  color: var(--muted);
  max-width: 620px;
  margin: 0;
}

.label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 6px;
}
.label.inline { display: inline; margin-right: 6px; }
.muted { color: var(--muted); }
.muted.small { font-size: 13px; }
.small { font-size: 13px; }
.mono { font-family: var(--mono); font-size: 13px; }

blockquote {
  margin: 0 0 10px;
  padding: 10px 14px;
  border-left: 2px solid var(--ink);
  background: transparent;
  font-family: var(--serif);
  font-variation-settings: "opsz" 18, "wght" 400;
  font-size: 16px;
  line-height: 1.5;
  color: var(--ink);
}
blockquote.emph {
  border-left-color: var(--accent);
  color: var(--ink);
  font-variation-settings: "opsz" 18, "wght" 500;
}

a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
a:hover { text-decoration-thickness: 2px; }

code { font-family: var(--mono); font-size: 0.88em; background: var(--paper-2); padding: 1px 6px; border-radius: 2px; color: var(--ink-2); }

/* ── matrix table ─────────────────────────────── */
.matrix {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}
.matrix thead th {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  text-align: left;
  padding: 10px 14px;
  border-bottom: 2px solid var(--ink);
  background: var(--paper);
}
.matrix tbody td {
  padding: 16px 14px;
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
}
.matrix tbody tr:hover { background: var(--paper-2); }
.col-name { width: 18%; font-family: var(--serif); font-variation-settings: "opsz" 24, "wght" 500; font-size: 19px; }
.col-tag { color: var(--ink-2); font-family: var(--serif); font-variation-settings: "opsz" 14, "wght" 400; font-size: 15px; line-height: 1.4; }
.col-price { width: 16%; font-family: var(--mono); font-size: 13px; color: var(--ink); font-variant-numeric: tabular-nums; }
.col-ads { width: 18%; }
.col-ads .numeral { font-family: var(--serif); font-variation-settings: "opsz" 48, "wght" 600; font-size: 28px; font-variant-numeric: tabular-nums; margin-right: 8px; }
.col-ads .numeral.lit { color: var(--accent); }
.col-ads .numeral.dim { color: var(--rule); }
.col-reviews { width: 10%; font-family: var(--mono); font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rev-pos { color: var(--pos); margin-right: 8px; }
.rev-neg { color: var(--neg); }
.comp-type { font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-top: 2px; }
.comp-link { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--rule); }
.comp-link:hover { border-bottom-color: var(--accent); color: var(--accent); }

/* ── tags / chips ─────────────────────────────── */
.tag {
  display: inline-block;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 8px;
  border: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink-2);
  margin-right: 4px;
  border-radius: 2px;
  vertical-align: middle;
}
.tag-on { background: var(--pos-soft); color: var(--pos); border-color: var(--pos); }
.tag-burst { background: var(--warn-soft); color: var(--warn); border-color: var(--warn); }
.tag-mixed { background: var(--paper-2); color: var(--ink-2); }
.tag-unknown, .tag-neutral { background: var(--paper-2); color: var(--muted); }
.tag-format { background: var(--paper); color: var(--muted); }
.tag-positive { background: var(--pos-soft); color: var(--pos); border-color: var(--pos); }
.tag-negative { background: var(--neg-soft); color: var(--neg); border-color: var(--neg); }
.tag-mixed { background: var(--warn-soft); color: var(--warn); border-color: var(--warn); }

/* ── positioning grid ─────────────────────────── */
.pos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 1px;
  background: var(--rule);
  border: 1px solid var(--rule);
}
.pos-card {
  background: var(--paper);
  padding: 24px 26px;
}
.pos-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
.pos-head h3 { font-family: var(--serif); font-variation-settings: "opsz" 32, "wght" 600; font-size: 24px; margin: 0; line-height: 1.1; letter-spacing: -0.01em; }
.pos-head .src { font-family: var(--mono); font-size: 11px; color: var(--muted); text-decoration: none; }
.pos-head .src:hover { color: var(--accent); }
.pos-body { display: grid; gap: 14px; }

/* ── pricing grid ─────────────────────────────── */
.price-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}
.price-card {
  background: var(--paper);
  border: 1px solid var(--rule);
  padding: 22px 24px;
}
.price-card header {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--rule);
  gap: 12px; flex-wrap: wrap;
}
.price-card h3 { font-family: var(--serif); font-variation-settings: "opsz" 30, "wght" 600; font-size: 22px; margin: 0; }
.price-card .src { font-family: var(--mono); font-size: 11px; color: var(--muted); text-decoration: none; }
.tier-list, .gate-list { list-style: none; padding: 0; margin: 0 0 14px; }
.tier, .gated { font-family: var(--mono); font-size: 13px; padding: 6px 0; border-bottom: 1px dashed var(--rule); color: var(--ink-2); font-variant-numeric: tabular-nums; }
.tier:last-child, .gated:last-child { border-bottom: 0; }
.gated { color: var(--warn); }
.packaging { font-family: var(--serif); font-variation-settings: "opsz" 14, "wght" 400; font-size: 14px; line-height: 1.5; color: var(--ink-2); margin: 0; }

/* ── ads section ──────────────────────────────── */
.bar-chart {
  background: var(--paper-2);
  border: 1px solid var(--rule);
  padding: 24px 28px;
  margin-bottom: 32px;
}
.bar-legend {
  display: flex;
  gap: 18px;
  margin-bottom: 16px;
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.bar-legend span::before {
  content: "";
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  vertical-align: middle;
}
.leg-meta::before { background: var(--accent); }
.leg-linked::before { background: #2a5d8a; }
.leg-goog::before { background: #8a5a00; }
.bar-row {
  display: grid;
  grid-template-columns: 160px 1fr 60px;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px dotted var(--rule);
}
.bar-row:last-child { border-bottom: 0; }
.bar-name { font-family: var(--serif); font-variation-settings: "opsz" 18, "wght" 500; font-size: 16px; }
.bar-track { height: 22px; background: var(--paper); border: 1px solid var(--rule); position: relative; display: flex; overflow: hidden; }
.bar-seg { height: 100%; transition: width .2s; }
.seg-meta { background: var(--accent); }
.seg-linked { background: #2a5d8a; }
.seg-goog { background: #8a5a00; }
.bar-fill { height: 100%; background: var(--accent); }
.bar-fill.dim { background: var(--rule); }
.bar-count { font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 15px; text-align: right; color: var(--ink); }
.plat-pills { display: flex; gap: 4px; margin-top: 4px; }
.plat-pill { font-family: var(--mono); font-size: 10px; font-weight: 500; padding: 1px 5px; background: var(--paper-2); border: 1px solid var(--rule); color: var(--muted); letter-spacing: 0.02em; }
.plat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px dotted var(--rule); }
.plat-block { padding: 10px 12px; background: var(--paper-2); border: 1px solid var(--rule); }
.plat-block.plat-dim { opacity: 0.55; }
.plat-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.plat-label { font-family: var(--mono); font-size: 10px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; }
.plat-label.plat-meta { background: var(--accent); color: white; }
.plat-label.plat-linkedin { background: #2a5d8a; color: white; }
.plat-label.plat-google { background: #8a5a00; color: white; }
.plat-count { font-family: var(--serif); font-variation-settings: "opsz" 48, "wght" 600; font-size: 24px; font-variant-numeric: tabular-nums; }
.plat-count.lit { color: var(--ink); }
.plat-count.dim { color: var(--rule); }
.plat-src { display: block; margin-top: 8px; font-family: var(--mono); font-size: 10px; color: var(--muted); text-decoration: none; }
.plat-src:hover { color: var(--accent); }
.hook-list.compact .hook { font-size: 13px; padding: 6px 0 6px 28px; line-height: 1.4; }

.poster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
}
.poster {
  background: var(--paper);
  border: 1px solid var(--ink);
  padding: 20px 22px;
  position: relative;
  box-shadow: 4px 4px 0 var(--paper-2);
}
.poster-empty { border-color: var(--rule); box-shadow: none; opacity: 0.7; }
.poster-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid var(--ink); }
.poster-empty .poster-head { border-bottom-color: var(--rule); }
.poster-name { font-family: var(--serif); font-variation-settings: "opsz" 36, "wght" 700; font-size: 26px; margin: 0; line-height: 1.05; letter-spacing: -0.01em; }
.poster-sub { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-top: 4px; }
.poster-count { text-align: right; }
.numeral.big { font-family: var(--serif); font-variation-settings: "opsz" 144, "wght" 600; font-size: 44px; line-height: 1; font-variant-numeric: tabular-nums; display: block; }
.numeral.big.lit { color: var(--accent); }
.numeral.big.dim { color: var(--rule); }
.numeral-label { font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }

.poster-meta { margin-bottom: 14px; }
.poster-hooks { margin-bottom: 12px; }
.hook-list { list-style: none; padding: 0; margin: 0; counter-reset: hook; }
.hook {
  counter-increment: hook;
  font-family: var(--serif);
  font-variation-settings: "opsz" 16, "wght" 400;
  font-size: 15px;
  line-height: 1.5;
  padding: 8px 0 8px 32px;
  border-bottom: 1px dotted var(--rule);
  position: relative;
  color: var(--ink-2);
}
.hook:last-child { border-bottom: 0; }
.hook::before {
  content: counter(hook, decimal-leading-zero);
  position: absolute;
  left: 0;
  top: 8px;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 0.05em;
}
.poster-ctas { margin-bottom: 10px; }
.cta { display: inline-block; margin: 0 4px 4px 0; font-size: 12px; padding: 2px 6px; }
.poster-geos { margin-bottom: 12px; }
.geo { display: inline-block; font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-right: 10px; }
.poster-foot { display: flex; justify-content: space-between; align-items: center; font-family: var(--mono); font-size: 11px; color: var(--muted); padding-top: 10px; border-top: 1px solid var(--rule); margin-top: 8px; }
.poster-foot a { color: var(--accent); }
.src-time { font-variant-numeric: tabular-nums; }

/* ── reviews ──────────────────────────────────── */
.review-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.review {
  background: var(--paper);
  border: 1px solid var(--rule);
  border-left: 4px solid var(--rule);
  padding: 18px 22px;
}
.review-pos { border-left-color: var(--pos); }
.review-neg { border-left-color: var(--neg); }
.review-mix { border-left-color: var(--warn); }
.review-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; font-size: 14px; }
.review-head strong { font-family: var(--serif); font-variation-settings: "opsz" 20, "wght" 600; font-size: 17px; margin-right: 4px; }

/* ── narrative arc ────────────────────────────── */
.arc-wrap { display: grid; gap: 24px; }
.arc { background: var(--paper); border-top: 2px solid var(--ink); padding: 20px 0 24px; }
.arc header h3 { font-family: var(--serif); font-variation-settings: "opsz" 40, "wght" 700; font-size: 30px; margin: 0 0 18px; letter-spacing: -0.01em; }
.arc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--rule); border: 1px solid var(--rule); margin-bottom: 16px; }
.arc-cell { background: var(--paper); padding: 16px 18px; }
.arc-cell p { margin: 0; font-family: var(--serif); font-variation-settings: "opsz" 16, "wght" 400; font-size: 15px; line-height: 1.5; color: var(--ink-2); }
.arc-villain .label { color: var(--neg); }
.arc-hero .label { color: var(--accent); }
.arc-trans .label { color: var(--pos); }
.arc-evidence {
  font-family: var(--serif);
  font-variation-settings: "opsz" 24, "wght" 400;
  font-style: italic;
  font-size: 18px;
  border-left: 3px solid var(--accent);
  margin-bottom: 10px;
}
@media (max-width: 780px) {
  .arc-grid { grid-template-columns: 1fr; }
}

/* ── share of voice ───────────────────────────── */
.sov-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}
@media (max-width: 780px) {
  .sov-grid { grid-template-columns: 1fr; }
}
.chip-list { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-family: var(--mono); font-size: 12px; padding: 3px 8px; border: 1px solid var(--rule); background: var(--paper); border-radius: 2px; }
.src-list { list-style: none; padding: 0; margin: 0; }
.src-list li { padding: 8px 0; border-bottom: 1px dotted var(--rule); }
.src-list li:last-child { border-bottom: 0; }
.evidence-block ul { padding-left: 18px; }
.evidence-block li { margin-bottom: 6px; }

/* ── colophon ─────────────────────────────────── */
.colophon {
  max-width: 1120px;
  margin: 100px auto 0;
  padding: 0 40px 60px;
}
.colophon-rule { height: 4px; background: var(--ink); margin-bottom: 24px; position: relative; }
.colophon-rule::after { content: ""; position: absolute; left: 0; top: 0; width: 25%; height: 100%; background: var(--accent); }
.colophon-body { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 32px; margin-bottom: 24px; }
.colophon-body p { margin: 0; color: var(--ink-2); font-size: 14px; line-height: 1.55; }
.colophon-meta { font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding-top: 14px; border-top: 1px solid var(--rule); }
@media (max-width: 780px) {
  .colophon-body { grid-template-columns: 1fr; }
}

/* ── print ────────────────────────────────────── */
@media print {
  body { font-size: 11pt; }
  .toc { position: static; }
  .poster { break-inside: avoid; box-shadow: none; }
}
`;

// ── CLI ────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("generate-report.ts") || process.argv[1]?.endsWith("generate-report.js")) {
  const jsonPath = process.argv[2];
  const htmlPath = process.argv[3] ?? "/tmp/research-competitor-report.html";
  if (!jsonPath) {
    console.error("Usage: npx tsx scripts/generate-report.ts <output.json> [report.html]");
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const html = buildReport(raw);
  fs.writeFileSync(htmlPath, html);
  console.log(`[report] Wrote HTML report to ${htmlPath}`);
  console.log(`[report] Open with: open ${htmlPath}  (macOS)  or  start ${htmlPath}  (Win)`);
}
