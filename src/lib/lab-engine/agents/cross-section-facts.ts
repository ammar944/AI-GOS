// W3 deterministic pre-pass: extract shared fact tokens across the seven
// committed section bodies and diff them. The executive brief receives the
// emitted conflicts and must RESOLVE each one (scraped > tool-measured >
// corpus > model-stated); this module never calls a model and never throws.
//
// Scope is deliberately narrow: subject-company money/count facts grouped by a
// small key vocabulary (pricing tiers, ARR, valuation, customer counts, ACV,
// CAC). Competitor pricing is excluded by the subject-sentence filter — the
// cold read's defect was the SUBJECT's Business-plan price diverging across
// sections ($45 scraped vs $20 asserted vs "hidden"), not competitor noise.

export interface CrossSectionFactReading {
  sectionId: string;
  value: string;
  context: string;
}

export interface CrossSectionFactConflict {
  factKey: string;
  readings: CrossSectionFactReading[];
}

interface SectionBodyInput {
  sectionId: string;
  body: Record<string, unknown>;
}

const factKeywordPatterns: ReadonlyArray<{ key: string; pattern: RegExp }> = [
  { key: "team-plan price", pattern: /\bteam\b/i },
  { key: "business-plan price", pattern: /\bbusiness\b/i },
  { key: "enterprise-plan price", pattern: /\benterprise\b/i },
  { key: "pro-plan price", pattern: /\bpro\b/i },
  { key: "plus-plan price", pattern: /\bplus\b/i },
  { key: "ARR", pattern: /\bARR\b/ },
  { key: "valuation", pattern: /\bvaluation\b/i },
  { key: "customer count", pattern: /\b(?:customers|brands|organizations|companies use)\b/i },
  { key: "ACV", pattern: /\bACV\b/ },
  { key: "CAC", pattern: /\bCAC\b/ },
];

const moneyOrCountTokenPattern =
  /\$\d[\d,]*(?:\.\d+)?\s?[KMB]?(?:\s*\/\s*(?:seat|user|mo|month|yr|year))?|\b\d[\d,]*(?:\.\d+)?\s?[KMB]\+?\b|\b\d[\d,]{2,}\+?\b/g;

const maxConflicts = 8;
const maxContextLength = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    if (value.length > 20) {
      out.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
    return;
  }

  if (isRecord(value)) {
    for (const child of Object.values(value)) {
      collectStrings(child, out);
    }
  }
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/);
}

// "$45/seat" and "$45 / seat" and "$45/user" read as the same price point;
// "500,000+" and "500K+" do not (different tokens stay distinct readings —
// a normalization that merged them could hide a real conflict).
function normalizeFactValue(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\/(?:user|seat)\b/, "/seat")
    .replace(/\/(?:month|mo)\b/, "/mo")
    .replace(/\/(?:year|yr)\b/, "/yr")
    .replace(/,(?=\d{3}\b)/g, "");
}

function mentionsSubject({
  sentence,
  subjectName,
}: {
  sentence: string;
  subjectName: string;
}): boolean {
  return sentence.toLowerCase().includes(subjectName.toLowerCase());
}

export function extractCrossSectionFactConflicts({
  sections,
  subjectName,
}: {
  sections: readonly SectionBodyInput[];
  subjectName: string;
}): CrossSectionFactConflict[] {
  // factKey -> normalizedValue -> first reading carrying that value
  const readingsByKey = new Map<string, Map<string, CrossSectionFactReading>>();

  for (const section of sections) {
    const strings: string[] = [];
    collectStrings(section.body, strings);

    for (const text of strings) {
      for (const sentence of splitSentences(text)) {
        if (!mentionsSubject({ sentence, subjectName })) {
          continue;
        }

        const tokens = sentence.match(moneyOrCountTokenPattern);

        if (tokens === null) {
          continue;
        }

        for (const { key, pattern } of factKeywordPatterns) {
          if (!pattern.test(sentence)) {
            continue;
          }

          for (const token of tokens) {
            const normalized = normalizeFactValue(token);
            const byValue =
              readingsByKey.get(key) ??
              new Map<string, CrossSectionFactReading>();

            if (!readingsByKey.has(key)) {
              readingsByKey.set(key, byValue);
            }

            const dedupeKey = `${section.sectionId}::${normalized}`;

            if (!byValue.has(dedupeKey)) {
              byValue.set(dedupeKey, {
                context: sentence.slice(0, maxContextLength),
                sectionId: section.sectionId,
                value: token.trim(),
              });
            }
          }
        }
      }
    }
  }

  const conflicts: CrossSectionFactConflict[] = [];

  for (const [factKey, byValue] of readingsByKey) {
    const readings = Array.from(byValue.values());
    const distinctValues = new Set(
      readings.map((reading) => normalizeFactValue(reading.value)),
    );
    const distinctSections = new Set(
      readings.map((reading) => reading.sectionId),
    );

    if (distinctValues.size >= 2 && distinctSections.size >= 2) {
      conflicts.push({ factKey, readings });
    }
  }

  return conflicts
    .sort((left, right) => right.readings.length - left.readings.length)
    .slice(0, maxConflicts);
}
