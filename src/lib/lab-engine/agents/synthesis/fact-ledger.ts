export type FactReadingBasis =
  | "measured-tool-data"
  | "subject-own-page-sourced"
  | "corroborated-secondary"
  | "benchmark"
  | "model-stated"
  | "absent";

export type FactValueUnit =
  | "money"
  | "count"
  | "percent"
  | "searches-per-month"
  | "days"
  | "unknown";

export type FactDomain =
  | "subject-price"
  | "competitor-price"
  | "customer-count"
  | "keyword-cluster"
  | "operator-economics"
  | "sales-cycle";

export interface KeywordMetric {
  keyword: string;
  monthlyVolume: number;
  cpc?: number;
  intentType?: string;
  sourceSection: string;
}

export interface KeywordClusterReading {
  clusterName: string;
  keywords: Array<{
    keyword: string;
    monthlyVolume: number;
    cpc?: number;
  }>;
  totalMonthlyVolume: number;
}

export interface FactLedgerReading {
  sectionId: string;
  factKey: string;
  label: string;
  value: string;
  normalizedValue?: number;
  unit: FactValueUnit;
  basis: FactReadingBasis;
  context: string;
  sourceUrl?: string;
  keywordCluster?: KeywordClusterReading;
}

export interface FactLedgerFact {
  factKey: string;
  label: string;
  domain: FactDomain;
  readings: FactLedgerReading[];
  winner?: FactLedgerReading;
  winnerBasis: string;
  disputed: boolean;
}

export interface FactLedger {
  subjectName: string;
  facts: FactLedgerFact[];
  keywordMetrics: KeywordMetric[];
  absentSections: string[];
}

export interface SynthesisSectionInput {
  sectionId: string;
  sectionTitle?: string;
  verdict?: string;
  statusSummary?: string;
  body: Record<string, unknown>;
  review?: Record<string, unknown>;
  verifierSummary?: Record<string, unknown>;
}

interface BuildFactLedgerParams {
  sections: readonly SynthesisSectionInput[];
  subjectName: string;
  subjectWebsiteUrl?: string;
  requiredSectionIds?: readonly string[];
}

interface StringLeaf {
  path: string;
  value: string;
}

interface AddReadingParams {
  domain: FactDomain;
  factKey: string;
  label: string;
  reading: Omit<FactLedgerReading, "factKey" | "label">;
}

const basisRank: Record<FactReadingBasis, number> = {
  "measured-tool-data": 5,
  "subject-own-page-sourced": 4,
  "corroborated-secondary": 3,
  benchmark: 2,
  "model-stated": 1,
  absent: 0,
};

const factOwnerByDomain: Record<FactDomain, string> = {
  "subject-price": "positioningOfferDiagnostic",
  "competitor-price": "positioningCompetitorLandscape",
  "customer-count": "positioningOfferDiagnostic",
  "keyword-cluster": "positioningDemandIntent",
  "operator-economics": "positioningPaidMediaPlan",
  "sales-cycle": "positioningOfferDiagnostic",
};

const subjectPricePlans: readonly string[] = [
  "free",
  "team",
  "business",
  "enterprise",
  "enterprise scale",
  "pro",
  "plus",
];

const contextLimit = 240;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateContext(value: string): string {
  const normalized = normalizeWhitespace(value);

  return normalized.length <= contextLimit
    ? normalized
    : `${normalized.slice(0, contextLimit - 1)}…`;
}

function normalizeSubjectToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hostMatchesSubject({
  sourceUrl,
  subjectName,
  subjectWebsiteUrl,
}: {
  sourceUrl: string | undefined;
  subjectName: string;
  subjectWebsiteUrl: string | undefined;
}): boolean {
  if (sourceUrl === undefined) {
    return false;
  }

  const normalizedSource = normalizeSubjectToken(sourceUrl);
  const normalizedSubject = normalizeSubjectToken(subjectName);

  if (
    normalizedSubject.length > 0 &&
    normalizedSource.includes(normalizedSubject)
  ) {
    return true;
  }

  if (subjectWebsiteUrl === undefined) {
    return false;
  }

  try {
    const subjectHost = new URL(subjectWebsiteUrl).hostname.replace(/^www\./, "");
    const sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, "");

    return sourceHost === subjectHost || sourceHost.endsWith(`.${subjectHost}`);
  } catch {
    return false;
  }
}

function collectStringLeaves({
  out,
  path,
  value,
}: {
  out: StringLeaf[];
  path: string;
  value: unknown;
}): void {
  if (typeof value === "string") {
    if (value.trim().length > 0) {
      out.push({ path, value });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStringLeaves({ out, path: `${path}[${index}]`, value: item });
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    collectStringLeaves({
      out,
      path: path.length === 0 ? key : `${path}.${key}`,
      value: child,
    });
  }
}

function collectSectionLeaves(section: SynthesisSectionInput): StringLeaf[] {
  const leaves: StringLeaf[] = [];

  collectStringLeaves({ out: leaves, path: "body", value: section.body });

  if (section.verdict !== undefined) {
    leaves.push({ path: "verdict", value: section.verdict });
  }

  if (section.statusSummary !== undefined) {
    leaves.push({ path: "statusSummary", value: section.statusSummary });
  }

  return leaves;
}

function getRecordString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getRecordNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function sourceUrlNear(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const direct = getRecordString(value, "sourceUrl");

  if (direct !== undefined) {
    return direct;
  }

  for (const child of Object.values(value)) {
    const nested = sourceUrlNear(child);

    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function inferBasis({
  context,
  sourceUrl,
  subjectName,
  subjectWebsiteUrl,
}: {
  context: string;
  sourceUrl?: string;
  subjectName: string;
  subjectWebsiteUrl?: string;
}): FactReadingBasis {
  if (
    /\b(?:spyfu|keyword_volume|tool[-\s]?measured|measured|google trends)\b/i.test(
      context,
    )
  ) {
    return "measured-tool-data";
  }

  if (
    hostMatchesSubject({ sourceUrl, subjectName, subjectWebsiteUrl }) ||
    /\bpricing page\b/i.test(context)
  ) {
    return "subject-own-page-sourced";
  }

  if (/\b(?:benchmark|industry|client brief|operator-supplied)\b/i.test(context)) {
    return "benchmark";
  }

  if (sourceUrl !== undefined) {
    return "corroborated-secondary";
  }

  return "model-stated";
}

function numericFromToken(raw: string): number | undefined {
  const normalized = raw
    .replace(/[,$%]/g, "")
    .replace(/\+/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const match = /^(\d+(?:\.\d+)?)([kmb])?$/.exec(normalized);

  if (match === null) {
    return undefined;
  }

  const base = Number.parseFloat(match[1]);

  if (!Number.isFinite(base)) {
    return undefined;
  }

  const suffix = match[2];

  if (suffix === "k") {
    return base * 1_000;
  }

  if (suffix === "m") {
    return base * 1_000_000;
  }

  if (suffix === "b") {
    return base * 1_000_000_000;
  }

  return base;
}

function normalizedValue(raw: string): number | undefined {
  const rangeParts = raw
    .replace(/[()]/g, "")
    .split(/\s*[-–]\s*/)
    .map((part) =>
      numericFromToken(
        part.replace(/\s*\/\s*(?:seat|user|mo|month|yr|year|click)\b/gi, ""),
      ),
    )
    .filter((part): part is number => part !== undefined);

  if (rangeParts.length > 1) {
    return rangeParts.reduce((sum, value) => sum + value, 0) / rangeParts.length;
  }

  return rangeParts[0] ?? numericFromToken(raw.replace(/\/(?:seat|user|mo|month|yr|year|click)/gi, ""));
}

function extractNumberTokens(text: string): string[] {
  const matches = text.match(
    /\$?\d[\d,]*(?:\.\d+)?(?:\s?[KMBkmb]\b)?\+?(?:\s*[-–]\s*\$?\d[\d,]*(?:\.\d+)?(?:\s?[KMBkmb]\b)?\+?)?(?:\s*%|\s*\/\s*(?:seat|user|mo|month|yr|year|click))?/g,
  );

  return (matches ?? []).filter((token) => {
    const cleaned = token.replace(/[^\d]/g, "");

    if (/^\d{4}[-–]\d{1,2}/.test(token.trim())) {
      return false;
    }

    return !/^(?:19|20)\d{2}$/.test(cleaned);
  });
}

function inferUnit(raw: string, context: string): FactValueUnit {
  if (raw.includes("$")) {
    return "money";
  }

  if (raw.includes("%")) {
    return "percent";
  }

  if (/\b(?:search|volume|queries|keywords?)\b/i.test(context)) {
    return "searches-per-month";
  }

  if (/\b(?:day|sales cycle)\b/i.test(context)) {
    return "days";
  }

  if (/\b(?:customers|brands|organizations|companies)\b/i.test(context)) {
    return "count";
  }

  return "unknown";
}

function planKeyFromContext(context: string): string | undefined {
  const lower = context.toLowerCase();

  return subjectPricePlans.find((plan) => {
    const pattern = new RegExp(`\\b${plan.replace(/\s+/g, "\\s+")}\\b`, "i");

    return pattern.test(lower);
  });
}

function keywordFactKeyFromContext(context: string): string | undefined {
  if (/\b(?:no-code|low-code|category terms?|broad(?:er)? category)\b/i.test(context)) {
    return "keyword-cluster:category-terms";
  }

  if (
    /\b(?:non-brand|competitor(?:-alternative)?|solution-aware|capture ceiling|combined)\b/i.test(
      context,
    )
  ) {
    return "keyword-cluster:non-brand-capture-ceiling";
  }

  return undefined;
}

function labelForFactKey(factKey: string): string {
  return factKey
    .replace(/^subject-price:/, "Subject price: ")
    .replace(/^competitor-price:/, "Competitor price: ")
    .replace(/^keyword-cluster:/, "Keyword cluster: ")
    .replace(/-/g, " ");
}

function domainForFactKey(factKey: string): FactDomain {
  if (factKey.startsWith("subject-price:")) {
    return "subject-price";
  }

  if (factKey.startsWith("competitor-price:")) {
    return "competitor-price";
  }

  if (factKey.startsWith("keyword-cluster:")) {
    return "keyword-cluster";
  }

  if (factKey === "customer-count") {
    return "customer-count";
  }

  if (factKey === "sales-cycle-days") {
    return "sales-cycle";
  }

  return "operator-economics";
}

function pushReading(
  readingsByFact: Map<string, AddReadingParams[]>,
  params: AddReadingParams,
): void {
  const readings = readingsByFact.get(params.factKey) ?? [];
  const dedupeKey = [
    params.reading.sectionId,
    params.reading.value,
    params.reading.context,
  ].join("::");
  const exists = readings.some(
    (entry) =>
      [
        entry.reading.sectionId,
        entry.reading.value,
        entry.reading.context,
      ].join("::") === dedupeKey,
  );

  if (!exists) {
    readings.push(params);
  }

  readingsByFact.set(params.factKey, readings);
}

function addTextReadings({
  readingsByFact,
  section,
  subjectName,
  subjectWebsiteUrl,
}: {
  readingsByFact: Map<string, AddReadingParams[]>;
  section: SynthesisSectionInput;
  subjectName: string;
  subjectWebsiteUrl?: string;
}): void {
  for (const leaf of collectSectionLeaves(section)) {
    const fullText = normalizeWhitespace(leaf.value);
    const context = truncateContext(fullText);
    const tokens = extractNumberTokens(fullText);

    if (tokens.length === 0) {
      continue;
    }

    const sourceUrl = sourceUrlNear(section.body);
    const basis = inferBasis({
      context,
      sourceUrl,
      subjectName,
      subjectWebsiteUrl,
    });
    const keywordFactKey = keywordFactKeyFromContext(fullText);
    const factKeys: string[] = [];

    // Subject prices attribute per sentence: a price in a sentence that does
    // not mention the subject (e.g. a competitor's price in the same leaf)
    // must not become a subject-price reading.
    const sentences = fullText.split(/(?<=[.!?])\s+/);
    const subjectSentences = sentences.filter((sentence) =>
      sentence.toLowerCase().includes(subjectName.toLowerCase()),
    );
    const subjectPriceTokens = new Set<string>();
    let plan: string | undefined;

    for (const sentence of subjectSentences) {
      const sentencePlan = planKeyFromContext(sentence);

      if (sentencePlan === undefined) {
        continue;
      }

      for (const token of tokens) {
        if (token.includes("$") && sentence.includes(token)) {
          plan = plan ?? sentencePlan;
          subjectPriceTokens.add(token);
        }
      }
    }

    if (plan !== undefined && subjectPriceTokens.size > 0) {
      factKeys.push(`subject-price:${plan.replace(/\s+/g, "-")}`);
    }

    if (/\bARR\b|annual recurring revenue/i.test(fullText)) {
      factKeys.push("ARR");
    }

    if (/\b(?:ACV|annual contract value)\b/i.test(fullText)) {
      factKeys.push("acv");
    }

    if (/\b(?:CAC|CPL|cost per (?:lead|trial|mql|conversion))\b/i.test(fullText)) {
      factKeys.push("cac-target");
    }

    if (/\b(?:budget|spend)\b/i.test(fullText)) {
      factKeys.push("monthly-budget");
    }

    if (/\b(?:sales cycle|upgrade cycle)\b/i.test(fullText)) {
      factKeys.push("sales-cycle-days");
    }

    if (/\b(?:customers|brands|organizations|companies use)\b/i.test(fullText)) {
      factKeys.push("customer-count");
    }

    if (keywordFactKey !== undefined) {
      factKeys.push(keywordFactKey);
    }

    for (const factKey of factKeys) {
      const domain = domainForFactKey(factKey);
      const allowedTokens = tokens.filter((token) => {
        if (domain === "keyword-cluster") {
          return !token.includes("$") && !token.includes("%");
        }

        if (domain === "customer-count") {
          return !token.includes("$");
        }

        if (domain === "sales-cycle") {
          return /\bday/i.test(context);
        }

        if (domain === "subject-price") {
          return subjectPriceTokens.has(token);
        }

        if (
          domain === "operator-economics" ||
          domain === "competitor-price"
        ) {
          return token.includes("$") || token.includes("%");
        }

        return true;
      });

      for (const token of allowedTokens) {
        pushReading(readingsByFact, {
          domain,
          factKey,
          label: labelForFactKey(factKey),
          reading: {
            basis,
            context,
            normalizedValue: normalizedValue(token),
            sectionId: section.sectionId,
            sourceUrl,
            unit: inferUnit(token, context),
            value: token.trim(),
          },
        });
      }
    }
  }
}

function metricFromKeywordRecord({
  record,
  sectionId,
}: {
  record: Record<string, unknown>;
  sectionId: string;
}): KeywordMetric | null {
  const keyword = getRecordString(record, "keyword");
  const monthlyVolume = getRecordNumber(record, "monthlyVolumeValue");

  if (keyword === undefined || monthlyVolume === undefined) {
    return null;
  }

  return {
    keyword,
    monthlyVolume,
    ...(getRecordNumber(record, "cpcValue") === undefined
      ? {}
      : { cpc: getRecordNumber(record, "cpcValue") }),
    ...(getRecordString(record, "intentType") === undefined
      ? {}
      : { intentType: getRecordString(record, "intentType") }),
    sourceSection: sectionId,
  };
}

function getDemandKeywordMetrics(section: SynthesisSectionInput): KeywordMetric[] {
  const keywordDemand = isRecord(section.body.keywordDemand)
    ? section.body.keywordDemand
    : {};
  const keywords = Array.isArray(keywordDemand.keywords)
    ? keywordDemand.keywords
    : [];

  return keywords.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const metric = metricFromKeywordRecord({
      record: item,
      sectionId: section.sectionId,
    });

    return metric === null ? [] : [metric];
  });
}

function isNonBrandCaptureMetric(metric: KeywordMetric, subjectName: string): boolean {
  const keyword = metric.keyword.toLowerCase();
  const normalizedSubject = subjectName.toLowerCase();

  if (keyword === normalizedSubject) {
    return false;
  }

  if (keyword === `${normalizedSubject} pricing`) {
    return false;
  }

  return (
    metric.intentType === "commercial" ||
    /\btemplates?\b/i.test(metric.keyword)
  );
}

function isCompetitorAlternativeMetric(metric: KeywordMetric): boolean {
  return /\b(?:vs|alternatives?|reviews?)\b/i.test(metric.keyword);
}

function isCategoryTermMetric(metric: KeywordMetric): boolean {
  return /\b(?:no[-\s]?code|low[-\s]?code|spreadsheet database|project management software)\b/i.test(
    metric.keyword,
  );
}

function addKeywordClusterReading({
  factKey,
  label,
  metrics,
  readingsByFact,
  sectionId,
}: {
  factKey: string;
  label: string;
  metrics: readonly KeywordMetric[];
  readingsByFact: Map<string, AddReadingParams[]>;
  sectionId: string;
}): void {
  if (metrics.length === 0) {
    return;
  }

  const total = metrics.reduce(
    (sum, metric) => sum + metric.monthlyVolume,
    0,
  );
  const keywords = metrics.map((metric) => ({
    keyword: metric.keyword,
    monthlyVolume: metric.monthlyVolume,
    ...(metric.cpc === undefined ? {} : { cpc: metric.cpc }),
  }));

  pushReading(readingsByFact, {
    domain: "keyword-cluster",
    factKey,
    label,
    reading: {
      basis: "measured-tool-data",
      context: `${label}: ${keywords.map((keyword) => `${keyword.keyword} ${keyword.monthlyVolume}/mo`).join(", ")}`,
      keywordCluster: {
        clusterName: label,
        keywords,
        totalMonthlyVolume: total,
      },
      normalizedValue: total,
      sectionId,
      sourceUrl: "https://www.spyfu.com/",
      unit: "searches-per-month",
      value: `${total.toLocaleString("en-US")} searches/mo`,
    },
  });
}

function addStructuredAcvReadings({
  readingsByFact,
  section,
  subjectName,
  subjectWebsiteUrl,
}: {
  readingsByFact: Map<string, AddReadingParams[]>;
  section: SynthesisSectionInput;
  subjectName: string;
  subjectWebsiteUrl?: string;
}): void {
  const marketSize = isRecord(section.body.marketSize) ? section.body.marketSize : {};
  const bottomUpTam = isRecord(marketSize.bottomUpTam)
    ? marketSize.bottomUpTam
    : {};
  const inputs = Array.isArray(bottomUpTam.inputs) ? bottomUpTam.inputs : [];

  for (const input of inputs) {
    if (!isRecord(input)) {
      continue;
    }

    const inputType = getRecordString(input, "inputType") ?? "";
    const label = getRecordString(input, "label") ?? "";

    if (!/\b(?:acv|annual contract value)\b/i.test(`${inputType} ${label}`)) {
      continue;
    }

    const value = getRecordString(input, "value");

    if (value === undefined) {
      continue;
    }

    const sourceUrl = getRecordString(input, "sourceUrl");
    const tokens = extractNumberTokens(value).filter((token) => token.includes("$"));
    const context = truncateContext(`${label}: ${value}`);

    for (const token of tokens) {
      pushReading(readingsByFact, {
        domain: "operator-economics",
        factKey: "acv",
        label: "ACV",
        reading: {
          basis: inferBasis({
            context,
            sourceUrl,
            subjectName,
            subjectWebsiteUrl,
          }),
          context,
          normalizedValue: normalizedValue(token),
          sectionId: section.sectionId,
          sourceUrl,
          unit: "money",
          value: token.trim(),
        },
      });
    }
  }
}

function addKeywordReadings({
  keywordMetrics,
  readingsByFact,
  section,
  subjectName,
}: {
  keywordMetrics: KeywordMetric[];
  readingsByFact: Map<string, AddReadingParams[]>;
  section: SynthesisSectionInput;
  subjectName: string;
}): void {
  const metrics = getDemandKeywordMetrics(section);

  keywordMetrics.push(...metrics);

  addKeywordClusterReading({
    factKey: "keyword-cluster:non-brand-capture-ceiling",
    label: "Keyword cluster: non brand capture ceiling",
    metrics: metrics.filter((metric) =>
      isNonBrandCaptureMetric(metric, subjectName),
    ),
    readingsByFact,
    sectionId: section.sectionId,
  });
  addKeywordClusterReading({
    factKey: "keyword-cluster:competitor-alternative",
    label: "Keyword cluster: competitor alternative",
    metrics: metrics.filter(isCompetitorAlternativeMetric),
    readingsByFact,
    sectionId: section.sectionId,
  });
  addKeywordClusterReading({
    factKey: "keyword-cluster:category-terms",
    label: "Keyword cluster: category terms",
    metrics: metrics.filter(isCategoryTermMetric),
    readingsByFact,
    sectionId: section.sectionId,
  });
}

function isDisputed(readings: readonly FactLedgerReading[]): boolean {
  const values = readings
    .map((reading) => reading.normalizedValue)
    .filter((value): value is number => value !== undefined && value > 0);

  if (values.length < 2) {
    return false;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  return (max - min) / Math.max(min, 1) > 0.2;
}

function winnerForFact({
  domain,
  readings,
}: {
  domain: FactDomain;
  readings: readonly FactLedgerReading[];
}): FactLedgerReading | undefined {
  const owner = factOwnerByDomain[domain];

  return [...readings].sort((left, right) => {
    const basisDelta = basisRank[right.basis] - basisRank[left.basis];

    if (basisDelta !== 0) {
      return basisDelta;
    }

    if (left.sectionId === owner && right.sectionId !== owner) {
      return -1;
    }

    if (right.sectionId === owner && left.sectionId !== owner) {
      return 1;
    }

    return left.sectionId.localeCompare(right.sectionId);
  })[0];
}

function buildWinnerBasis(winner: FactLedgerReading | undefined): string {
  if (winner === undefined) {
    return "no readings available";
  }

  return `${winner.basis}; selected from ${winner.sectionId}`;
}

export function buildFactLedger({
  requiredSectionIds = [],
  sections,
  subjectName,
  subjectWebsiteUrl,
}: BuildFactLedgerParams): FactLedger {
  const readingsByFact = new Map<string, AddReadingParams[]>();
  const keywordMetrics: KeywordMetric[] = [];

  for (const section of sections) {
    addStructuredAcvReadings({
      readingsByFact,
      section,
      subjectName,
      subjectWebsiteUrl,
    });
    addKeywordReadings({
      keywordMetrics,
      readingsByFact,
      section,
      subjectName,
    });
    addTextReadings({
      readingsByFact,
      section,
      subjectName,
      subjectWebsiteUrl,
    });
  }

  const facts = [...readingsByFact.entries()]
    .map(([factKey, entries]): FactLedgerFact => {
      const first = entries[0];
      const domain = first?.domain ?? domainForFactKey(factKey);
      const readings = entries.map((entry) => ({
        ...entry.reading,
        factKey,
        label: entry.label,
      }));
      const winner = winnerForFact({ domain, readings });

      return {
        disputed: isDisputed(readings),
        domain,
        factKey,
        label: first?.label ?? labelForFactKey(factKey),
        readings,
        ...(winner === undefined ? {} : { winner }),
        winnerBasis: buildWinnerBasis(winner),
      };
    })
    .sort((left, right) => left.factKey.localeCompare(right.factKey));
  const presentSections = new Set(sections.map((section) => section.sectionId));
  const absentSections = requiredSectionIds.filter(
    (sectionId) => !presentSections.has(sectionId),
  );

  return {
    absentSections: [...absentSections],
    facts,
    keywordMetrics,
    subjectName,
  };
}

export function findLedgerFact(
  ledger: FactLedger,
  factKey: string,
): FactLedgerFact | undefined {
  return ledger.facts.find((fact) => fact.factKey === factKey);
}

export function ledgerWinnerReadings(ledger: FactLedger): FactLedgerReading[] {
  return ledger.facts.flatMap((fact) =>
    fact.winner === undefined ? [] : [fact.winner],
  );
}
