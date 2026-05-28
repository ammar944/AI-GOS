/**
 * Normalize company name for comparison:
 * - Lowercase
 * - Remove common suffixes (Inc, LLC, Corp, Ltd, etc.)
 * - Remove punctuation and extra whitespace
 * - Trim
 */
function normalizeCompanyName(name: string): string {
  if (name.trim().length === 0) {
    return "";
  }

  let normalized = name.toLowerCase().trim();

  const suffixes = [
    /\s+inc\.?$/i,
    /\s+llc\.?$/i,
    /\s+corp\.?$/i,
    /\s+corporation$/i,
    /\s+ltd\.?$/i,
    /\s+limited$/i,
    /\s+co\.?$/i,
    /\s+company$/i,
    /\s+group$/i,
    /\s+international$/i,
    /\s+intl\.?$/i,
  ];

  for (const suffix of suffixes) {
    normalized = normalized.replace(suffix, "");
  }

  normalized = normalized.replace(
    /\.(com|io|ai|co|net|org|app|dev|tech|us|me|xyz)$/i,
    "",
  );
  normalized = normalized.replace(/[^\w\s]/g, "");
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Calculate what fraction of the longer string's words overlap with the shorter string.
 */
function calculateWordOverlapRatio(shorter: string, longer: string): number {
  const shortWords = shorter.split(/\s+/).filter((word) => word.length > 0);
  const longWords = longer.split(/\s+/).filter((word) => word.length > 0);

  if (longWords.length === 0) {
    return 0;
  }

  const matchedCount = longWords.filter((longWord) =>
    shortWords.some(
      (shortWord) =>
        shortWord === longWord ||
        shortWord.includes(longWord) ||
        longWord.includes(shortWord),
    ),
  ).length;

  return matchedCount / longWords.length;
}

/**
 * Calculate Jaro-Winkler similarity between two strings.
 * Returns a score from 0 (completely different) to 1 (identical).
 *
 * Jaro-Winkler is designed for short strings like company names
 * and gives higher scores to strings with matching prefixes.
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1.length === 0 || str2.length === 0) {
    return 0;
  }

  if (str1 === str2) {
    return 1;
  }

  const s1 = normalizeCompanyName(str1);
  const s2 = normalizeCompanyName(str2);

  if (s1 === s2) {
    return 1;
  }

  if (s1.length === 0 || s2.length === 0) {
    return 0;
  }

  const shorter = s1.length <= s2.length ? s1 : s2;
  const longer = s1.length <= s2.length ? s2 : s1;

  if (shorter.length <= 6) {
    if (longer === shorter) {
      return 1;
    }

    if (longer.startsWith(`${shorter} `)) {
      const extraPart = longer.substring(shorter.length + 1).trim();
      const extraWords = extraPart.split(/\s+/).filter((word) => word.length > 0);
      const corporateSuffixes = new Set([
        "inc",
        "llc",
        "corp",
        "ltd",
        "limited",
        "co",
        "company",
        "group",
        "international",
        "intl",
        "technologies",
        "software",
        "solutions",
        "platform",
        "hq",
      ]);
      const allSuffixes = extraWords.every((word) =>
        corporateSuffixes.has(word.toLowerCase()),
      );

      if (allSuffixes && extraWords.length <= 2) {
        return 0.95;
      }

      return 0.5;
    }

    const words = longer.split(" ");

    if (words.some((word) => word === shorter) && words[0] !== shorter) {
      return 0.4;
    }

    if (s1.substring(0, 2) !== s2.substring(0, 2)) {
      return 0.3;
    }

    return 0.5;
  }

  if (s1.includes(s2)) {
    const wordBoundaryMatch =
      s1.startsWith(`${s2} `) ||
      s1.endsWith(` ${s2}`) ||
      s1.includes(` ${s2} `) ||
      s1 === s2;

    if (!wordBoundaryMatch) {
      return 0.5;
    }

    const overlapRatio = calculateWordOverlapRatio(s2, s1);
    return Math.min(0.95, 0.55 + 0.4 * overlapRatio);
  }

  if (s2.includes(s1)) {
    const wordBoundaryMatch =
      s2.startsWith(`${s1} `) ||
      s2.endsWith(` ${s1}`) ||
      s2.includes(` ${s1} `) ||
      s2 === s1;

    if (!wordBoundaryMatch) {
      return 0.5;
    }

    const overlapRatio = calculateWordOverlapRatio(s1, s2);
    return Math.min(0.95, 0.55 + 0.4 * overlapRatio);
  }

  const matchWindow = Math.max(s1.length, s2.length) / 2 - 1;
  const s1Matches = new Array<boolean>(s1.length).fill(false);
  const s2Matches = new Array<boolean>(s2.length).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let index = 0; index < s1.length; index += 1) {
    const start = Math.max(0, index - matchWindow);
    const end = Math.min(index + matchWindow + 1, s2.length);

    for (let matchIndex = start; matchIndex < end; matchIndex += 1) {
      if (s2Matches[matchIndex] === true || s1[index] !== s2[matchIndex]) {
        continue;
      }

      s1Matches[index] = true;
      s2Matches[matchIndex] = true;
      matches += 1;
      break;
    }
  }

  if (matches === 0) {
    return 0;
  }

  let nextMatchIndex = 0;

  for (let index = 0; index < s1.length; index += 1) {
    if (!s1Matches[index]) {
      continue;
    }

    while (!s2Matches[nextMatchIndex]) {
      nextMatchIndex += 1;
    }

    if (s1[index] !== s2[nextMatchIndex]) {
      transpositions += 1;
    }

    nextMatchIndex += 1;
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  const prefixLength = Math.min(4, Math.min(s1.length, s2.length));
  let prefix = 0;

  for (let index = 0; index < prefixLength; index += 1) {
    if (s1[index] === s2[index]) {
      prefix += 1;
    } else {
      break;
    }
  }

  const jaroWinkler = jaro + prefix * 0.1 * (1 - jaro);
  return Math.min(jaroWinkler, 1);
}

/**
 * Extract company name from domain.
 * Examples: "tesla.com" -> "tesla", "www.amazon.com" -> "amazon"
 */
export function extractCompanyFromDomain(domain: string): string | undefined {
  if (domain.length === 0) {
    return undefined;
  }

  try {
    let cleaned = domain.replace(/^https?:\/\//, "");
    cleaned = cleaned.replace(/^www\./, "");
    cleaned = cleaned.split("/")[0]?.split("?")[0] ?? "";

    const parts = cleaned.split(".");

    if (parts.length >= 2) {
      if (
        parts.length >= 3 &&
        ["co", "com", "org", "net"].includes(parts[parts.length - 2] ?? "")
      ) {
        return parts[parts.length - 3];
      }

      return parts[parts.length - 2];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export function normalizeDomain(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0] ?? value
  );
}

const corporateSuffixes = new Set([
  "inc",
  "llc",
  "corp",
  "ltd",
  "limited",
  "co",
  "company",
  "group",
  "international",
  "intl",
  "technologies",
  "software",
  "solutions",
  "platform",
  "hq",
]);

/**
 * Check if an advertiser name matches the searched company.
 * Uses multi-layer validation:
 * 1. Exact match (normalized)
 * 2. Full containment (one name contains the other)
 * 3. First-word match + Jaro-Winkler (the advertiser's FIRST word must match)
 * 4. Domain-based fallback (advertiser starts with the domain base)
 *
 * Rejects: "Direct Metals" vs "Directive" (different first words, JW=0.82)
 * Rejects: "TEPLOBAK Buffer Tanks" vs "Buffer" (buffer is not the first word)
 * Passes:  "Buffer Inc" vs "Buffer" (first word matches exactly)
 *
 * Wave 6e Hole 3 fix: when `adUrl` is provided AND the company name is short
 * (<=6 chars) AND a domain is provided, REQUIRE the ad URL to contain the domain.
 * This catches the multi-company-same-name leak: e.g. an ad whose advertiser is
 * literally "Fathom" but whose clickthrough goes to fathomdem.com instead of
 * fathom.video. Without this guard, Layer 1 (exact match) would accept it
 * because the names are byte-identical.
 *
 * Behavior matrix (short name + verified domain + adUrl):
 *   url contains domain -> fall through to existing layers
 *   url present but doesn't contain domain -> REJECT (domain mismatch)
 *   url missing/empty -> fall through (permissive, name-only match still allowed)
 *
 * For long names or when adUrl is undefined, this guard does nothing - backward
 * compatible with existing callers (eval scripts, tests, normalizeSearchApi*).
 */
export function isAdvertiserMatch(
  advertiserName: string | undefined,
  companyName: string,
  domain?: string,
  adUrl?: string,
): boolean {
  if (advertiserName === undefined) {
    return false;
  }

  const advNorm = advertiserName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
  const compNorm = companyName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
  const adLibraryPathPatterns = /\/ad[-_]library\/|\/ads\/library\/|\/advertiser\//i;
  const compLenForGuard = compNorm.replace(/\s+/g, "").length;

  if (compLenForGuard <= 6 && domain !== undefined && adUrl !== undefined) {
    const url = adUrl.toLowerCase();
    const dom = normalizeDomain(domain).toLowerCase();
    let decodedUrl = url;

    try {
      decodedUrl = decodeURIComponent(url);
    } catch {
      decodedUrl = url;
    }

    const isAdLibraryUrl = adLibraryPathPatterns.test(decodedUrl);

    if (url.length > 0 && !isAdLibraryUrl && !decodedUrl.includes(dom)) {
      return false;
    }
  }

  if (advNorm === compNorm) {
    return true;
  }

  const isShortName = compNorm.replace(/\s+/g, "").length <= 6;

  if (
    advNorm.startsWith(`${compNorm} `) ||
    (advNorm.startsWith(compNorm) && advNorm.length === compNorm.length)
  ) {
    if (isShortName && advNorm !== compNorm) {
      const extra = advNorm.substring(compNorm.length).trim();
      const extraWords = extra.split(/\s+/).filter((word) => word.length > 0);

      if (
        extraWords.length > 0 &&
        !extraWords.every((word) => corporateSuffixes.has(word))
      ) {
        // Fall through to other layers.
      } else {
        return true;
      }
    } else {
      return true;
    }
  }

  if (
    compNorm.startsWith(`${advNorm} `) ||
    (compNorm.startsWith(advNorm) && compNorm.length === advNorm.length)
  ) {
    if (isShortName && compNorm !== advNorm) {
      const extra = compNorm.substring(advNorm.length).trim();
      const extraWords = extra.split(/\s+/).filter((word) => word.length > 0);

      if (
        extraWords.length > 0 &&
        !extraWords.every((word) => corporateSuffixes.has(word))
      ) {
        // Fall through to other layers.
      } else {
        return true;
      }
    } else {
      return true;
    }
  }

  const advWords = advNorm.split(" ").filter((word) => word.length > 1);
  const compWords = compNorm.split(" ").filter((word) => word.length > 1);
  const advFirst = advWords[0] ?? "";
  const compFirst = compWords[0] ?? "";

  if (advFirst === compFirst && advFirst.length > 0 && !isShortName) {
    if (calculateSimilarity(advertiserName, companyName) >= 0.8) {
      return true;
    }
  }

  if (domain !== undefined) {
    const domainBase = normalizeDomain(domain).split(".")[0] ?? "";

    if (domainBase.length >= 3) {
      if (isShortName) {
        const advertiserWords = advNorm.split(" ");

        if (
          advertiserWords[0] === domainBase &&
          (advertiserWords.length === 1 ||
            advertiserWords.slice(1).every((word) => corporateSuffixes.has(word)))
        ) {
          return true;
        }
      } else if (advNorm.startsWith(domainBase)) {
        return true;
      }
    }
  }

  return false;
}

interface Candidate {
  id: string;
  name: string;
}

interface ResolverResult {
  verdict: "accepted" | "ambiguous" | "rejected";
  candidate?: Candidate;
  reason: string;
  candidates?: Array<{ name: string; score: number; domainMatch: boolean }>;
}

/**
 * Resolve the best candidate from a list using identity verification.
 * Returns a verdict (accepted/ambiguous/rejected) with the matched candidate.
 *
 * isDomainVerified = true when the domain came from Sonar validation (not inferred).
 * When false (inferred domain like "atlas.com"), triggers exact-match-only mode
 * for short names.
 */
export function resolveBestCandidate(
  candidates: Candidate[],
  companyName: string,
  domain?: string,
  isDomainVerified?: boolean,
): ResolverResult {
  if (candidates.length === 0) {
    return { verdict: "rejected", reason: "No candidates returned by API" };
  }

  const compNorm = companyName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
  const domainBase = domain !== undefined ? extractCompanyFromDomain(domain) : undefined;
  const isShortName = compNorm.replace(/\s+/g, "").length <= 6;

  const scored = candidates.map((candidate) => {
    const score = calculateSimilarity(candidate.name, companyName);
    const exactMatch = score >= 1;
    let domainMatch = false;

    if (domainBase !== undefined && isDomainVerified === true) {
      const candidateNorm = candidate.name.toLowerCase();
      const base = domainBase.toLowerCase();

      if (isShortName) {
        const hasBase = new RegExp(`\\b${base}\\b`).test(candidateNorm);

        if (hasBase) {
          const companyWords = compNorm.split(/\s+/);
          const qualifiers = companyWords.filter(
            (word) => word.toLowerCase() !== base && word.length > 1,
          );

          if (qualifiers.length === 0) {
            domainMatch = true;
          } else {
            domainMatch =
              qualifiers.some((qualifier) =>
                candidateNorm.includes(qualifier.toLowerCase()),
              ) || score >= 0.85;
          }
        }
      } else {
        const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        domainMatch = new RegExp(`\\b${escaped}\\b`).test(candidateNorm);
      }
    }

    return {
      candidate,
      name: candidate.name,
      score,
      exactMatch,
      domainMatch,
    };
  });

  scored.sort((left, right) => {
    if (left.exactMatch !== right.exactMatch) {
      return left.exactMatch ? -1 : 1;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.domainMatch !== right.domainMatch) {
      return left.domainMatch ? -1 : 1;
    }

    return 0;
  });

  const candidateLog = scored.map((score) => ({
    name: score.name,
    score: score.score,
    domainMatch: score.domainMatch,
  }));
  const top = scored[0];
  const runnerUp = scored[1];

  if (top === undefined) {
    return { verdict: "rejected", reason: "No candidates returned by API" };
  }

  // Early rejection for short names with a verified domain when NO candidate corroborates it.
  // When isDomainVerified=true, the platform-specific fetchers already ran a domain-first
  // lookup. If those succeeded, we never reach resolveBestCandidate with mismatched
  // candidates. If they failed and we fell back to name search, a name-search result that
  // doesn't corroborate the verified domain is likely the wrong entity.
  if (isShortName && isDomainVerified === true && domainBase !== undefined) {
    const hasDomainCorroboration = scored.some((score) => score.domainMatch);

    if (!hasDomainCorroboration) {
      return {
        verdict: "ambiguous",
        candidate: top.candidate,
        reason: `Short name "${companyName}" (<=6 chars) with verified domain "${domain}": no candidate corroborates domain base "${domainBase}". Accepting top candidate "${top.name}" (${top.score.toFixed(2)}) provisionally - downstream guards will re-check.`,
        candidates: candidateLog,
      };
    }
  }

  if (top.exactMatch) {
    if (isShortName && !top.domainMatch && isDomainVerified === true) {
      const domainMatchedCandidate = scored.find((score) => score.domainMatch);

      if (domainMatchedCandidate !== undefined) {
        return {
          verdict: "accepted",
          candidate: domainMatchedCandidate.candidate,
          reason: `Short name "${companyName}": domain corroboration preferred over exact name match "${top.name}". Domain match: "${domainMatchedCandidate.name}" (verified domain: "${domain}")`,
          candidates: candidateLog,
        };
      }

      return {
        verdict: "ambiguous",
        candidate: top.candidate,
        reason: `Short name "${companyName}" has exact match "${top.name}" but no domain corroboration with "${domain}". Could be wrong entity.`,
        candidates: candidateLog,
      };
    }

    if (isShortName && isDomainVerified !== true) {
      return {
        verdict: "ambiguous",
        candidate: top.candidate,
        reason: `Short name "${companyName}" has exact match "${top.name}" but domain is unverified. Cannot confirm identity.`,
        candidates: candidateLog,
      };
    }

    return {
      verdict: "accepted",
      candidate: top.candidate,
      reason: `Exact match: "${top.name}"`,
      candidates: candidateLog,
    };
  }

  if (top.domainMatch && isDomainVerified === true) {
    return {
      verdict: "accepted",
      candidate: top.candidate,
      reason: `Domain corroboration: "${top.name}" matches verified domain "${domain}"`,
      candidates: candidateLog,
    };
  }

  const margin = runnerUp !== undefined ? top.score - runnerUp.score : 1;

  if (top.score >= 0.95 && margin >= 0.15) {
    return {
      verdict: "accepted",
      candidate: top.candidate,
      reason: `Dominant candidate: "${top.name}" (score=${top.score.toFixed(2)}, margin=${margin.toFixed(2)})`,
      candidates: candidateLog,
    };
  }

  if (top.score < 0.8) {
    return {
      verdict: "rejected",
      reason: `Best candidate "${top.name}" scored ${top.score.toFixed(2)} (below 0.8 threshold)`,
      candidates: candidateLog,
    };
  }

  if (isShortName && isDomainVerified !== true) {
    return {
      verdict: "ambiguous",
      reason: `Short name "${companyName}" (<=6 chars) with unverified domain, no exact match. Top: "${top.name}" (${top.score.toFixed(2)})`,
      candidates: candidateLog,
    };
  }

  if (isShortName && isDomainVerified === true && !top.domainMatch) {
    return {
      verdict: "ambiguous",
      reason: `Short name "${companyName}" with verified domain "${domain}" but no corroboration. Top: "${top.name}" (${top.score.toFixed(2)})`,
      candidates: candidateLog,
    };
  }

  if (runnerUp !== undefined && runnerUp.score >= 0.8 && margin < 0.15) {
    return {
      verdict: "ambiguous",
      reason: `Multiple candidates: "${top.name}" (${top.score.toFixed(2)}) vs "${runnerUp.name}" (${runnerUp.score.toFixed(2)}), margin=${margin.toFixed(2)}`,
      candidates: candidateLog,
    };
  }

  return {
    verdict: "accepted",
    candidate: top.candidate,
    reason: `Best match: "${top.name}" (score=${top.score.toFixed(2)})`,
    candidates: candidateLog,
  };
}
