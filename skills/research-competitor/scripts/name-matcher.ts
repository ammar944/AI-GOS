/**
 * Name / identity matching for competitor resolution.
 * Ported from research-worker/src/utils/name-matcher.ts and adlibrary.ts's
 * resolveBestCandidate, simplified for this skill's needs.
 *
 * Why: SearchAPI's page-search returns many candidates per query. For short names
 * like "Fathom", "Gong", or "Krisp", naive first-match picks the wrong page and
 * returns 0 ads. This resolver layers:
 *   1. normalized exact match
 *   2. domain corroboration (candidate name contains the domain base)
 *   3. Jaro-Winkler similarity with strict rules for short names
 * Returns `{ verdict, candidate, reason }` so callers can log and audit.
 */

const CORPORATE_SUFFIXES = new Set([
  "inc", "llc", "corp", "ltd", "limited", "co", "company", "group",
  "international", "intl", "technologies", "software", "solutions",
  "platform", "hq",
]);

export function normalizeCompanyName(name: string): string {
  if (!name) return "";
  let s = name.toLowerCase().trim();
  // Strip corporate suffixes
  s = s
    .replace(/\s+(inc\.?|llc\.?|corp\.?|corporation|ltd\.?|limited|co\.?|company|group|international|intl\.?)$/i, "")
    // TLD suffixes: "Salesforce.com" → "salesforce", "Fathom.ai" → "fathom"
    .replace(/\.(com|io|ai|co|net|org|app|dev|tech|us|me|xyz)$/i, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

export function extractCompanyFromDomain(domain?: string): string | undefined {
  if (!domain) return undefined;
  const cleaned = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
  const parts = cleaned.split(".");
  if (parts.length >= 2) {
    if (
      parts.length >= 3 &&
      ["co", "com", "org", "net"].includes(parts[parts.length - 2])
    ) {
      return parts[parts.length - 3];
    }
    return parts[parts.length - 2];
  }
  return undefined;
}

function wordOverlap(shorter: string, longer: string): number {
  const s = shorter.split(/\s+/).filter(Boolean);
  const l = longer.split(/\s+/).filter(Boolean);
  if (!l.length) return 0;
  const matched = l.filter((lw) =>
    s.some((sw) => sw === lw || sw.includes(lw) || lw.includes(sw)),
  ).length;
  return matched / l.length;
}

/** Jaro-Winkler with short-name guardrails. Returns 0..1. */
export function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const s1 = normalizeCompanyName(a);
  const s2 = normalizeCompanyName(b);
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;

  const shorter = s1.length <= s2.length ? s1 : s2;
  const longer = s1.length <= s2.length ? s2 : s1;

  if (shorter.length <= 6) {
    if (longer === shorter) return 1;
    if (longer.startsWith(shorter + " ")) {
      const extras = longer
        .slice(shorter.length + 1)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const allSuffixes = extras.every((w) => CORPORATE_SUFFIXES.has(w));
      if (allSuffixes && extras.length <= 2) return 0.95;
      return 0.5;
    }
    const words = longer.split(" ");
    if (words.includes(shorter) && words[0] !== shorter) return 0.4;
    if (s1.slice(0, 2) !== s2.slice(0, 2)) return 0.3;
    return 0.5;
  }

  if (s1.includes(s2) || s2.includes(s1)) {
    const needle = s1.includes(s2) ? s2 : s1;
    const hay = s1.includes(s2) ? s1 : s2;
    const wb = hay.startsWith(needle + " ") || hay.endsWith(" " + needle) || hay.includes(" " + needle + " ");
    if (!wb) return 0.5;
    return Math.min(0.95, 0.55 + 0.4 * wordOverlap(needle, hay));
  }

  // Jaro
  const mw = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const m1 = new Array(s1.length).fill(false);
  const m2 = new Array(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - mw);
    const end = Math.min(i + mw + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (m2[j] || s1[i] !== s2[j]) continue;
      m1[i] = true;
      m2[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let trans = 0, k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) trans++;
    k++;
  }
  const jaro = (matches / s1.length + matches / s2.length + (matches - trans / 2) / matches) / 3;
  let prefix = 0;
  const pl = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < pl; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return Math.min(jaro + prefix * 0.1 * (1 - jaro), 1);
}

// ─── resolver ────────────────────────────────────────────────────────────

export interface Candidate {
  name: string;
  id: string;
  entity?: Record<string, unknown>;
}

export interface ResolverResult {
  verdict: "accepted" | "ambiguous" | "rejected";
  candidate?: Candidate;
  reason: string;
  debug?: Array<{ name: string; score: number; domainMatch: boolean }>;
}

const ACCEPT_SCORE = 0.8;
const STRONG_SCORE = 0.95;

/**
 * Pick the best candidate for a company name, using domain corroboration when
 * available. `isDomainVerified=true` means the domain came from a trusted source
 * (Sonar validation / user input), so it gets to anchor identity. `false` means
 * we inferred it from the company name and it's only a tiebreaker.
 */
export function resolveBestCandidate(
  candidates: Candidate[],
  companyName: string,
  domain?: string,
  isDomainVerified?: boolean,
): ResolverResult {
  if (!candidates.length) {
    return { verdict: "rejected", reason: "no candidates" };
  }

  const compNorm = normalizeCompanyName(companyName);
  const domainBase = extractCompanyFromDomain(domain);
  const isShort = compNorm.replace(/\s+/g, "").length <= 6;

  const scored = candidates.map((c) => {
    const score = calculateSimilarity(c.name, companyName);
    const exactMatch = score >= 1;
    let domainMatch = false;
    if (domainBase) {
      const cn = c.name.toLowerCase();
      const base = domainBase.toLowerCase();
      const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      domainMatch = new RegExp(`\\b${escaped}\\b`).test(cn);
      // For short names with a qualifier (e.g. "Fathom AI"), require the qualifier
      // OR a high name similarity, to avoid matching "Fathom" the other company.
      if (isShort && domainMatch) {
        const qualifiers = compNorm.split(/\s+/).filter((w) => w !== base && w.length > 1);
        if (qualifiers.length > 0) {
          const hasQual = qualifiers.some((q) => cn.includes(q));
          if (!hasQual && score < 0.85) domainMatch = false;
        }
      }
    }
    return { candidate: c, name: c.name, score, exactMatch, domainMatch };
  });

  scored.sort((a, b) => {
    if (a.exactMatch !== b.exactMatch) return a.exactMatch ? -1 : 1;
    if (a.domainMatch !== b.domainMatch) return a.domainMatch ? -1 : 1;
    return b.score - a.score;
  });

  const debug = scored.map((s) => ({ name: s.name, score: s.score, domainMatch: s.domainMatch }));
  const top = scored[0];

  // Short name + verified domain with NO candidate corroborating: ambiguous, not reject.
  // Let callers try the top candidate with the `ambiguous` signal; downstream filters can guard.
  if (isShort && isDomainVerified && domainBase) {
    const anyCorr = scored.some((s) => s.domainMatch);
    if (!anyCorr) {
      return {
        verdict: "ambiguous",
        candidate: top.candidate,
        reason: `short name "${companyName}" + verified domain "${domain}" but no candidate contains base "${domainBase}"`,
        debug,
      };
    }
  }

  if (top.exactMatch && top.domainMatch) {
    return { verdict: "accepted", candidate: top.candidate, reason: `exact + domain: "${top.name}"`, debug };
  }
  if (top.exactMatch && !isShort) {
    return { verdict: "accepted", candidate: top.candidate, reason: `exact match: "${top.name}"`, debug };
  }
  if (top.domainMatch && isDomainVerified) {
    return { verdict: "accepted", candidate: top.candidate, reason: `domain corroboration: "${top.name}" ~ ${domain}`, debug };
  }
  if (top.score >= STRONG_SCORE) {
    return { verdict: "accepted", candidate: top.candidate, reason: `strong match ${top.score.toFixed(2)}: "${top.name}"`, debug };
  }
  if (top.score >= ACCEPT_SCORE) {
    return { verdict: "ambiguous", candidate: top.candidate, reason: `soft match ${top.score.toFixed(2)}: "${top.name}"`, debug };
  }
  return { verdict: "rejected", reason: `best score ${top.score.toFixed(2)} below ${ACCEPT_SCORE}`, debug };
}
