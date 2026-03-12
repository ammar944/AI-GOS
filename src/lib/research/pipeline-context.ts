interface OnboardingData {
  companyName?: string;
  companyUrl?: string;
  industry?: string;
  businessModel?: string;
  productDescription?: string;
  goals?: string;
  competitors?: string | string[];
  [key: string]: unknown;
}

interface SectionArtifact {
  data: Record<string, unknown>;
}

interface CompetitorArtifact extends SectionArtifact {
  data: {
    competitors?: unknown;
  } & Record<string, unknown>;
}

interface DependencySection {
  heading: string;
  data: Record<string, unknown>;
}

const KNOWN_FIELD_LABELS: Record<string, string> = {
  companyName: 'Company Name',
  companyUrl: 'Website URL',
  industry: 'Industry',
  businessModel: 'Business Model',
  productDescription: 'Product Description',
  goals: 'Goals',
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function formatBusinessValue(value: unknown): string | null {
  if (isNonEmptyString(value)) {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value
      .flatMap((item) => {
        if (isNonEmptyString(item)) {
          return [item.trim()];
        }

        if (typeof item === 'number' || typeof item === 'boolean') {
          return [String(item)];
        }

        return [];
      })
      .filter((item, index, values) => values.indexOf(item) === index);

    return items.length > 0 ? items.join(', ') : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  return JSON.stringify(value);
}

function formatUnknownFieldLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

function dedupeStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function buildBusinessContextBlock(
  onboardingData: OnboardingData,
  extraLines: readonly string[] = [],
): string {
  const lines: string[] = ['Business context:'];

  for (const key of Object.keys(KNOWN_FIELD_LABELS)) {
    const value = formatBusinessValue(onboardingData[key]);
    if (!value) {
      continue;
    }

    lines.push(`- ${KNOWN_FIELD_LABELS[key]}: ${value}`);
  }

  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  for (const [key, rawValue] of Object.entries(onboardingData)) {
    if (key in KNOWN_FIELD_LABELS || key === 'competitors') {
      continue;
    }

    const value = formatBusinessValue(rawValue);
    if (!value) {
      continue;
    }

    lines.push(`- ${formatUnknownFieldLabel(key)}: ${value}`);
  }

  return lines.join('\n');
}

function buildDependencyBlocks(sections: readonly DependencySection[]): string {
  const blocks = sections.map(
    (section) => `## ${section.heading}\n${JSON.stringify(section.data, null, 2)}`,
  );

  return ['Existing persisted research to reuse:', ...blocks].join('\n\n');
}

function buildContextWithDependencies(input: {
  onboardingData: OnboardingData;
  extraLines?: readonly string[];
  dependencies: readonly DependencySection[];
}): string {
  return [
    buildBusinessContextBlock(input.onboardingData, input.extraLines),
    buildDependencyBlocks(input.dependencies),
  ].join('\n\n');
}

function extractOnboardingCompetitorNames(onboardingData: OnboardingData): string[] {
  const competitors = onboardingData.competitors;

  if (typeof competitors === 'string') {
    return dedupeStrings(
      competitors
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    );
  }

  if (Array.isArray(competitors)) {
    return dedupeStrings(
      competitors.filter((value): value is string => isNonEmptyString(value)),
    );
  }

  return [];
}

function extractCompetitorNames(competitorIntel: CompetitorArtifact): string[] {
  const competitors = competitorIntel.data.competitors;

  if (!Array.isArray(competitors)) {
    return [];
  }

  const names = competitors.flatMap((competitor) => {
    if (isNonEmptyString(competitor)) {
      return [competitor.trim()];
    }

    if (!competitor || typeof competitor !== 'object') {
      return [];
    }

    const name = (competitor as { name?: unknown }).name;
    return isNonEmptyString(name) ? [name.trim()] : [];
  });

  return dedupeStrings(names);
}

export function buildIndustryContext(onboardingData: OnboardingData): string {
  return buildBusinessContextBlock(onboardingData);
}

export function buildCompetitorContext(input: {
  onboardingData: OnboardingData;
  industryResearch: SectionArtifact;
}): string {
  const competitorNames = extractOnboardingCompetitorNames(input.onboardingData);
  const extraLines =
    competitorNames.length > 0
      ? [`- Top Competitors: ${competitorNames.join(', ')}`]
      : [];

  return buildContextWithDependencies({
    onboardingData: input.onboardingData,
    extraLines,
    dependencies: [
      {
        heading: 'Market Overview',
        data: input.industryResearch.data,
      },
    ],
  });
}

export function buildIcpContext(input: {
  onboardingData: OnboardingData;
  industryResearch: SectionArtifact;
  competitorIntel: SectionArtifact;
}): string {
  return buildContextWithDependencies({
    onboardingData: input.onboardingData,
    dependencies: [
      {
        heading: 'Market Overview',
        data: input.industryResearch.data,
      },
      {
        heading: 'Competitor Intel',
        data: input.competitorIntel.data,
      },
    ],
  });
}

export function buildOfferContext(input: {
  onboardingData: OnboardingData;
  industryResearch: SectionArtifact;
  competitorIntel: SectionArtifact;
  icpValidation: SectionArtifact;
}): string {
  return buildContextWithDependencies({
    onboardingData: input.onboardingData,
    dependencies: [
      {
        heading: 'Market Overview',
        data: input.industryResearch.data,
      },
      {
        heading: 'Competitor Intel',
        data: input.competitorIntel.data,
      },
      {
        heading: 'ICP Validation',
        data: input.icpValidation.data,
      },
    ],
  });
}

export function buildSynthesisContext(input: {
  onboardingData: OnboardingData;
  industryResearch: SectionArtifact;
  competitorIntel: SectionArtifact;
  icpValidation: SectionArtifact;
  offerAnalysis: SectionArtifact;
}): string {
  return buildContextWithDependencies({
    onboardingData: input.onboardingData,
    dependencies: [
      {
        heading: 'Market Overview',
        data: input.industryResearch.data,
      },
      {
        heading: 'Competitor Intel',
        data: input.competitorIntel.data,
      },
      {
        heading: 'ICP Validation',
        data: input.icpValidation.data,
      },
      {
        heading: 'Offer Analysis',
        data: input.offerAnalysis.data,
      },
    ],
  });
}

export function buildKeywordContext(input: {
  onboardingData: OnboardingData;
  industryResearch: SectionArtifact;
  competitorIntel: CompetitorArtifact;
  icpValidation: SectionArtifact;
  offerAnalysis: SectionArtifact;
  strategicSynthesis: SectionArtifact;
}): string {
  const competitorNames = dedupeStrings([
    ...extractCompetitorNames(input.competitorIntel),
    ...extractOnboardingCompetitorNames(input.onboardingData),
  ]);
  const extraLines =
    competitorNames.length > 0
      ? [`- Top Competitors: ${competitorNames.join(', ')}`]
      : [];

  return buildContextWithDependencies({
    onboardingData: input.onboardingData,
    extraLines,
    dependencies: [
      {
        heading: 'Market Overview',
        data: input.industryResearch.data,
      },
      {
        heading: 'Competitor Intel',
        data: input.competitorIntel.data,
      },
      {
        heading: 'ICP Validation',
        data: input.icpValidation.data,
      },
      {
        heading: 'Offer Analysis',
        data: input.offerAnalysis.data,
      },
      {
        heading: 'Strategic Synthesis',
        data: input.strategicSynthesis.data,
      },
    ],
  });
}
