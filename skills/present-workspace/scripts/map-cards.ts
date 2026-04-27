import type { PresentWorkspaceInput, SectionKey } from "../schemas/input.ts";
import type { SourcedClaim, WorkspaceCard } from "../schemas/output.ts";

type JsonRecord = Record<string, unknown>;

const FORBIDDEN_WRITE_KEYS = new Set([
  "__cardEdits",
  "research_results",
  "supabase",
  "supabase_write",
  "write_supabase",
]);

const META_KEYS = new Set([
  "run_id",
  "brief_snapshot_id",
  "stage",
  "company_name",
  "category",
  "generated_at",
]);

export class CardMappingError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CardMappingError";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => isRecord(item))
    : [];
}

function cloneRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function stableCardId(
  section: SectionKey,
  cardKind: string,
  label: string,
): string {
  const slug = slugify(label);
  if (!slug) {
    throw new CardMappingError(
      `Cannot build stable card id for section=${section} card_kind=${cardKind}: label is empty`,
    );
  }
  return `${section}-${cardKind}-${slug}`;
}

function isRenderable(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => isRenderable(item));
  }
  if (isRecord(value)) {
    return Object.values(value).some((item) => isRenderable(item));
  }
  return false;
}

function assertNoDirectWriteInstructions(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoDirectWriteInstructions(item, [...path, String(index)]));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_WRITE_KEYS.has(key)) {
      throw new CardMappingError(
        `Upstream skill output cannot include direct Supabase write instructions at ${[...path, key].join(".")}`,
      );
    }
    assertNoDirectWriteInstructions(nestedValue, [...path, key]);
  }
}

function toSourcedClaim(value: JsonRecord): SourcedClaim | null {
  const sourceUrl = asString(value.source_url);
  const retrievedAt = asString(value.retrieved_at);
  if (!sourceUrl || !retrievedAt) {
    return null;
  }

  const claimValue =
    asString(value.claim) ??
    asString(value.value) ??
    asString(value.text) ??
    asString(value.title) ??
    asString(value.name) ??
    asString(value.persona_name);

  if (!claimValue) {
    return null;
  }

  return {
    value: claimValue,
    source_url: sourceUrl,
    retrieved_at: retrievedAt,
  };
}

function collectEvidence(value: unknown): SourcedClaim[] {
  const claims: SourcedClaim[] = [];
  const seen = new Set<string>();

  function visit(item: unknown): void {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (!isRecord(item)) {
      return;
    }

    const claim = toSourcedClaim(item);
    if (claim) {
      const key = `${claim.value}|${claim.source_url}|${claim.retrieved_at}`;
      if (!seen.has(key)) {
        seen.add(key);
        claims.push(claim);
      }
    }

    Object.values(item).forEach(visit);
  }

  visit(value);
  return claims;
}

function makeCard(params: {
  input: PresentWorkspaceInput;
  cardKind: string;
  label: string;
  description?: string;
  content: JsonRecord;
  evidenceSeed: unknown;
}): WorkspaceCard {
  if (!isRenderable(params.content)) {
    throw new CardMappingError(
      `Empty renderable data for run_id=${params.input.run_id} section_key=${params.input.section_key} card_kind=${params.cardKind}`,
    );
  }

  const evidence = collectEvidence(params.evidenceSeed);
  if (evidence.length === 0) {
    throw new CardMappingError(
      `Card evidence missing for run_id=${params.input.run_id} section_key=${params.input.section_key} card_kind=${params.cardKind}`,
    );
  }

  return {
    id: stableCardId(params.input.section_key, params.cardKind, params.label),
    run_id: params.input.run_id,
    ...(params.input.brief_snapshot_id
      ? { brief_snapshot_id: params.input.brief_snapshot_id }
      : {}),
    section_key: params.input.section_key,
    card_kind: params.cardKind,
    card_type: params.cardKind,
    label: params.label,
    ...(params.description ? { description: params.description } : {}),
    content: cloneRecord(params.content),
    status: "draft",
    evidence,
  };
}

function mapIcpCards(input: PresentWorkspaceInput, skillOutput: JsonRecord): WorkspaceCard[] {
  const cards: WorkspaceCard[] = [];

  for (const persona of asRecordArray(skillOutput.persona_anchors)) {
    const label = asString(persona.persona_name) ?? "Primary ICP";
    cards.push(
      makeCard({
        input,
        cardKind: "persona-card",
        label,
        description: "Primary buyer segment with pains, triggers, objections, and alternatives.",
        content: {
          persona_name: label,
          role_family: asString(persona.role_family),
          seniority: asString(persona.seniority),
          company_context: persona.company_context ?? [],
          pains: persona.pains ?? [],
          triggers: persona.triggers ?? [],
          objections: persona.objections ?? [],
          current_alternatives: persona.current_alternatives ?? [],
        },
        evidenceSeed: persona,
      }),
    );
  }

  const jobTitles = asRecordArray(skillOutput.job_titles);
  if (jobTitles.length > 0) {
    cards.push(
      makeCard({
        input,
        cardKind: "job-title-list",
        label: "Validated Job Titles",
        description: "Job titles and buying roles surfaced from sourced ICP research.",
        content: {
          job_titles: jobTitles.map((title) => ({
            title: asString(title.title),
            department: asString(title.department),
            seniority: asString(title.seniority),
            buying_role: asString(title.buying_role),
          })),
        },
        evidenceSeed: jobTitles,
      }),
    );
  }

  const awarenessStages = asRecordArray(skillOutput.awareness_stages);
  if (awarenessStages.length > 0) {
    cards.push(
      makeCard({
        input,
        cardKind: "awareness-stage-card",
        label: "Awareness Stage",
        description: "Buyer awareness stage and message implication.",
        content: {
          stages: awarenessStages.map((stage) => ({
            stage: asString(stage.stage),
            message_implication: asString(stage.message_implication),
          })),
        },
        evidenceSeed: awarenessStages,
      }),
    );
  }

  const searchIntent = asRecordArray(skillOutput.search_intent);
  if (searchIntent.length > 0) {
    cards.push(
      makeCard({
        input,
        cardKind: "search-intent-grid",
        label: "Search Intent",
        description: "Search patterns mapped to ICP intent and likely persona.",
        content: {
          queries: searchIntent.map((query) => ({
            query_pattern: asString(query.query_pattern),
            intent: asString(query.intent),
            likely_persona: asString(query.likely_persona),
          })),
        },
        evidenceSeed: searchIntent,
      }),
    );
  }

  return cards;
}

function mapGenericCards(input: PresentWorkspaceInput, skillOutput: JsonRecord): WorkspaceCard[] {
  return Object.entries(skillOutput).flatMap(([key, value]) => {
    if (META_KEYS.has(key) || !isRenderable(value)) {
      return [];
    }

    const evidence = collectEvidence(value);
    if (evidence.length === 0) {
      return [];
    }

    const cardKind = `${slugify(key)}-card`;
    const label = titleize(key);
    const content = isRecord(value) ? cloneRecord(value) : { value: JSON.parse(JSON.stringify(value)) };

    return [
      makeCard({
        input,
        cardKind,
        label,
        content,
        evidenceSeed: value,
      }),
    ];
  });
}

export function mapWorkspaceCards(input: PresentWorkspaceInput): WorkspaceCard[] {
  const skillOutput = cloneRecord(input.skill_output);
  assertNoDirectWriteInstructions(skillOutput);

  const stage = asString(skillOutput.stage);
  const mappedCards =
    stage === "research-buyer-icp"
      ? mapIcpCards(input, skillOutput)
      : mapGenericCards(input, skillOutput);

  if (mappedCards.length === 0) {
    throw new CardMappingError(
      `Empty renderable data for run_id=${input.run_id} section_key=${input.section_key}`,
    );
  }

  return mappedCards;
}
