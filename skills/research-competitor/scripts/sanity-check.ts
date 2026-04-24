/**
 * Post-merge integrity checks. Runs between merge-sov and validate.
 * Catches tool-integration silent failures and enforces completeness heuristics.
 *
 * Exits non-zero on FAIL (unless --allow-suspect / ALLOW_SUSPECT=1).
 * Prints WARN to stderr and continues.
 *
 * Usage:
 *   npx tsx scripts/sanity-check.ts <output.json> [--allow-suspect]
 */
import * as fs from "fs";
import * as path from "path";
import type { ResearchCompetitorOutput } from "../schemas/output.js";

type Level = "fail" | "warn" | "ok";
type CheckResult = { level: Level; name: string; message: string; hint?: string };

// Gap 1: ad-integration sanity — statistically impossible for ≥3 competitors
// to all show 0 active ads across platforms; indicates broken name matching
// or missing SEARCHAPI_KEY.
function allCompetitorsZeroAds(o: ResearchCompetitorOutput): CheckResult {
  const inv = o.paid_social_ad_inventory ?? [];
  if (inv.length < 3) return { level: "ok", name: "all_zero_ads", message: "" };
  const zeros = inv.filter((x) => (x.active_ad_count ?? 0) === 0);
  if (zeros.length === inv.length) {
    return {
      level: "fail",
      name: "all_zero_ads",
      message: `All ${inv.length} competitors show active_ad_count=0. Statistically impossible for ≥3 competitors in a category where any advertiser is active.`,
      hint: "Verify SEARCHAPI_KEY is set. Run `tsx scripts/fetch-ads.ts \"monday.com\" monday.com` to confirm the integration on a known-heavy advertiser. Use ALLOW_SUSPECT=1 only if you manually verified zero advertising.",
    };
  }
  return { level: "ok", name: "all_zero_ads", message: "" };
}

// Gap 2: review saturation per competitor — need ≥N per polarity
// for pattern-level signal. Below floor warns with the count so the
// scout can re-dispatch the sub-agent or mark incomplete.
function reviewSaturationPerCompetitor(
  o: ResearchCompetitorOutput,
): CheckResult[] {
  const MIN = 5;
  const counts = new Map<string, { positive: number; negative: number }>();
  for (const r of o.review_mined_feedback ?? []) {
    const m = counts.get(r.name) ?? { positive: 0, negative: 0 };
    if (r.polarity === "positive") m.positive++;
    if (r.polarity === "negative") m.negative++;
    counts.set(r.name, m);
  }
  const out: CheckResult[] = [];
  for (const c of o.competitor_set) {
    const m = counts.get(c.name) ?? { positive: 0, negative: 0 };
    if (m.positive < MIN || m.negative < MIN) {
      out.push({
        level: "warn",
        name: "reviews_incomplete",
        message: `${c.name}: ${m.positive} positive + ${m.negative} negative (floor ${MIN} each for pattern signal).`,
        hint: `Re-run competitor sub-agent for ${c.name} with expanded sources (G2 → Capterra → TrustRadius → Reddit → HN). If unavailable after 3 source attempts, emit reviews_status.incomplete with reason.`,
      });
    }
  }
  return out;
}

// Gap 3: SoV evidence often names competitors outside the seed list.
// Extract candidate names from SoV evidence strings and flag unknowns.
function seedCrossCheckAgainstSoV(
  o: ResearchCompetitorOutput,
  outputPath: string,
): CheckResult {
  const known = new Set(o.competitor_set.map((c) => c.name.toLowerCase()));
  const STOP = new Set([
    "the", "and", "top", "best", "for", "is", "of", "to", "a", "vs",
    "plus", "free", "new", "all", "our", "your",
  ]);
  const candidates = new Set<string>();
  // Heuristic: plausible company-name tokens only.
  //   - Strip punctuation at edges
  //   - Must start with uppercase letter
  //   - 3–30 chars
  //   - No digits, no $, no parens, no slashes inside (excludes "$35M", "Series C ($35M")
  //   - 1 or 2 words max (competitor names are rarely 3+ words)
  //   - Not in stopword list
  const plausible = (w: string): boolean =>
    /^[A-Z][A-Za-z0-9.\- ]{2,29}$/.test(w) &&
    !/[\d$()%/[\]{}]/.test(w) &&
    w.split(/\s+/).length <= 2 &&
    !STOP.has(w.toLowerCase());
  const scan = (s: string | undefined) => {
    if (!s) return;
    s.split(/[,;|/]|\band\b|\bvs\.?\b/i)
      .map((w) => w.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.]+$/g, ""))
      .filter(plausible)
      .forEach((w) => candidates.add(w));
  };
  (o.share_of_voice?.publications_owned ?? []).forEach((p) =>
    scan(p.evidence),
  );
  (o.share_of_voice?.communities_owned ?? []).forEach((c) =>
    scan(c.evidence),
  );

  // Cross-check against excluded_seeds.json if present in the same dir
  let excludedNames = new Set<string>();
  try {
    const excludedPath = path.join(
      path.dirname(outputPath),
      "excluded_seeds.json",
    );
    if (fs.existsSync(excludedPath)) {
      const excluded = JSON.parse(
        fs.readFileSync(excludedPath, "utf-8"),
      ) as Array<{ name: string }>;
      excludedNames = new Set(excluded.map((e) => e.name.toLowerCase()));
    }
  } catch {
    /* no excluded_seeds.json — fine */
  }

  const novel = [...candidates].filter(
    (c) => !known.has(c.toLowerCase()) && !excludedNames.has(c.toLowerCase()),
  );

  if (novel.length >= 2) {
    return {
      level: "warn",
      name: "seed_list_leaks",
      message: `SoV evidence names ${novel.length} unknowns not in competitor_set or excluded_seeds.json: ${novel.slice(0, 10).join(", ")}`,
      hint: "If any appear in ≥2 SoV roundups, re-run with expanded seed list. If deliberately excluded, add each to excluded_seeds.json with {name, reason}.",
    };
  }
  return { level: "ok", name: "seed_list_leaks", message: "" };
}

// Gap 4: subject must be in frame. A landscape report without the subject
// cannot be benchmarked against rivals.
function subjectPresentInSet(o: ResearchCompetitorOutput): CheckResult {
  const subj = o.source_company_name.toLowerCase();
  const hit = o.competitor_set.some(
    (c) => c.name.toLowerCase() === subj || c.type === "subject",
  );
  if (!hit) {
    return {
      level: "fail",
      name: "subject_missing",
      message: `source_company_name "${o.source_company_name}" is not in competitor_set.`,
      hint: `Add {name: "${o.source_company_name}", type: "subject", source_url, retrieved_at} so the subject is analyzed on equal footing.`,
    };
  }
  return { level: "ok", name: "subject_missing", message: "" };
}

// Gap 5: verbatim fields must quote, not paraphrase. Flag sentinel markers.
function verbatimFieldsDontParaphrase(
  o: ResearchCompetitorOutput,
): CheckResult[] {
  const SUSPECT: RegExp[] = [
    /^summary\s*:/i,
    /\[paraphrase/i,
    /^approximately\b/i,
    /\bin\s+essence\b/i,
    /\broughly\b/i,
  ];
  const out: CheckResult[] = [];
  const scan = (owner: string, fieldPath: string, v: unknown) => {
    if (typeof v !== "string") return;
    for (const rx of SUSPECT) {
      if (rx.test(v)) {
        out.push({
          level: "warn",
          name: "paraphrase_in_verbatim",
          message: `${owner} :: ${fieldPath} matches paraphrase marker ${rx} — verbatim fields must quote directly or be omitted.`,
          hint: `Re-collect verbatim from ${owner}'s source, or delete the field entirely.`,
        });
        break;
      }
    }
  };
  for (const p of o.positioning_taxonomy ?? []) {
    scan(p.name, "problem_framing_verbatim", p.problem_framing_verbatim);
    scan(p.name, "solution_framing_verbatim", p.solution_framing_verbatim);
  }
  for (const n of o.competitor_narrative_arc ?? []) {
    scan(n.name, "villain", n.villain);
    scan(n.name, "hero", n.hero);
    scan(n.name, "transformation_claim", n.transformation_claim);
    scan(n.name, "evidence_verbatim", n.evidence_verbatim);
  }
  return out;
}

function main(): void {
  const outputPath = process.argv[2];
  const allowSuspect =
    process.argv.includes("--allow-suspect") ||
    process.env.ALLOW_SUSPECT === "1";
  if (!outputPath) {
    process.stderr.write(
      "Usage: sanity-check.ts <output.json> [--allow-suspect]\n",
    );
    process.exit(2);
  }
  const o = JSON.parse(
    fs.readFileSync(outputPath, "utf-8"),
  ) as ResearchCompetitorOutput;

  const results: CheckResult[] = [
    allCompetitorsZeroAds(o),
    subjectPresentInSet(o),
    seedCrossCheckAgainstSoV(o, outputPath),
    ...reviewSaturationPerCompetitor(o),
    ...verbatimFieldsDontParaphrase(o),
  ].filter((r) => r.level !== "ok");

  const fails = results.filter((r) => r.level === "fail");
  const warns = results.filter((r) => r.level === "warn");

  for (const r of [...fails, ...warns]) {
    const tag = r.level.toUpperCase();
    process.stderr.write(`[sanity-check][${tag}] ${r.name}: ${r.message}\n`);
    if (r.hint) process.stderr.write(`   ↳ ${r.hint}\n`);
  }

  if (fails.length && !allowSuspect) {
    process.stderr.write(
      `\n[sanity-check] ${fails.length} FAIL — blocking. ALLOW_SUSPECT=1 to override.\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `[sanity-check] ${fails.length} fail (allowed), ${warns.length} warn ✓\n`,
  );
}

main();
