import { normalizeStoredResearchResults } from '@/lib/journey/research-result-contract';
import { parseResearchToCards } from '@/lib/workspace/card-taxonomy';
import { SECTION_PIPELINE, WORKSPACE_SECTIONS } from '@/lib/workspace/pipeline';
import type {
  CardSnapshot,
  CardState,
  SectionKey,
  SectionPhase,
} from '@/lib/workspace/types';

export interface WorkspaceHydrationSection {
  section: SectionKey;
  phase: SectionPhase;
  cards: CardState[];
  error?: string;
}

export interface WorkspaceCardEdit {
  cardId: string;
  content: Record<string, unknown>;
}

export interface WorkspaceHydrationPlan {
  sections: WorkspaceHydrationSection[];
  cardEdits: WorkspaceCardEdit[];
}

const SECTION_PHASES: SectionPhase[] = [
  'queued',
  'researching',
  'streaming',
  'review',
  'approved',
  'error',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asSectionKey(value: unknown): SectionKey | null {
  return typeof value === 'string' &&
    (WORKSPACE_SECTIONS as readonly string[]).includes(value)
    ? (value as SectionKey)
    : null;
}

function asSectionPhase(value: unknown): SectionPhase | null {
  return typeof value === 'string' &&
    (SECTION_PHASES as readonly string[]).includes(value)
    ? (value as SectionPhase)
    : null;
}

function asCardStatus(value: unknown): CardState['status'] | null {
  return value === 'draft' || value === 'edited' || value === 'approved'
    ? value
    : null;
}

function asCardSnapshots(value: unknown): CardSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((candidate): CardSnapshot | null => {
      const record = isRecord(candidate) ? candidate : null;
      const content = record && isRecord(record.content) ? record.content : null;
      const editedBy = record?.editedBy;
      const timestamp = record?.timestamp;
      if (
        !content ||
        (editedBy !== 'user' && editedBy !== 'ai') ||
        typeof timestamp !== 'number'
      ) {
        return null;
      }

      return {
        content,
        editedBy,
        timestamp,
      };
    })
    .filter((snapshot): snapshot is CardSnapshot => snapshot !== null);
}

function asCardState(value: unknown, fallbackSection: SectionKey): CardState | null {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return null;
  }

  const id = asString(record.id);
  const cardType = asString(record.cardType);
  const label = asString(record.label);
  const content = isRecord(record.content) ? record.content : null;
  const status = asCardStatus(record.status);
  if (!id || !cardType || !label || !content || !status) {
    return null;
  }

  const sectionKey = asSectionKey(record.sectionKey) ?? fallbackSection;
  const description = asString(record.description);

  return {
    id,
    sectionKey,
    cardType,
    label,
    ...(description ? { description } : {}),
    content,
    status,
    versions: asCardSnapshots(record.versions),
  };
}

function getCompleteIntelData(
  researchResults: Record<string, unknown> | null,
  key:
    | 'opportunityIntel'
    | 'whiteSpaceGapIntel'
    | 'offerStatementIntel'
    | 'strategicSynthesisIntel',
): Record<string, unknown> | undefined {
  const result = isRecord(researchResults?.[key]) ? researchResults[key] : null;
  if (!isRecord(result) || result.status !== 'complete' || !isRecord(result.data)) {
    return undefined;
  }

  return result.data;
}

function buildIntelData(
  researchResults: Record<string, unknown> | null,
): {
  opportunityIntel?: Record<string, unknown>;
  whiteSpaceGapIntel?: Record<string, unknown>;
  offerStatementIntel?: Record<string, unknown>;
  strategicSynthesisIntel?: Record<string, unknown>;
} {
  return {
    opportunityIntel: getCompleteIntelData(researchResults, 'opportunityIntel'),
    whiteSpaceGapIntel: getCompleteIntelData(researchResults, 'whiteSpaceGapIntel'),
    offerStatementIntel: getCompleteIntelData(researchResults, 'offerStatementIntel'),
    strategicSynthesisIntel: getCompleteIntelData(
      researchResults,
      'strategicSynthesisIntel',
    ),
  };
}

function getViewHydrationSections(view: unknown): WorkspaceHydrationSection[] {
  const record = isRecord(view) ? view : null;
  const sections = Array.isArray(record?.sections) ? record.sections : [];
  const hydrated: WorkspaceHydrationSection[] = [];
  const seenSections = new Set<SectionKey>();

  for (const sectionCandidate of sections) {
    const sectionRecord = isRecord(sectionCandidate) ? sectionCandidate : null;
    const section = asSectionKey(sectionRecord?.id);
    const phase = asSectionPhase(sectionRecord?.phase);
    if (!section || !phase || seenSections.has(section)) {
      continue;
    }

    const cards = Array.isArray(sectionRecord?.cards)
      ? sectionRecord.cards
          .map((card) => asCardState(card, section))
          .filter((card): card is CardState => card !== null)
      : [];

    hydrated.push({
      section,
      phase,
      cards,
      error: asString(sectionRecord?.blocker) ?? undefined,
    });
    seenSections.add(section);
  }

  return hydrated;
}

function getFallbackHydrationSections(
  researchResults: Record<string, unknown> | null,
): WorkspaceHydrationSection[] {
  const normalizedResults = normalizeStoredResearchResults(
    researchResults,
    'boundary',
  );
  const intelData = buildIntelData(researchResults);
  const sections: WorkspaceHydrationSection[] = [];

  for (const section of SECTION_PIPELINE) {
    const result = normalizedResults[section];
    if (
      !result ||
      result.status !== 'complete' ||
      !isRecord(result.data)
    ) {
      continue;
    }

    const cards = parseResearchToCards(section, result.data, intelData);
    if (cards.length === 0) {
      continue;
    }

    sections.push({
      section,
      phase: 'review',
      cards,
      error: undefined,
    });
  }

  return sections;
}

function getCardEdits(
  researchResults: Record<string, unknown> | null,
): WorkspaceCardEdit[] {
  const edits: WorkspaceCardEdit[] = [];

  for (const candidate of Object.values(researchResults ?? {})) {
    const result = isRecord(candidate) ? candidate : null;
    const cardEdits = isRecord(result?.__cardEdits)
      ? result.__cardEdits
      : null;
    if (!cardEdits) {
      continue;
    }

    for (const [cardId, content] of Object.entries(cardEdits)) {
      if (!isRecord(content)) {
        continue;
      }

      edits.push({
        cardId,
        content,
      });
    }
  }

  return edits;
}

export function buildWorkspaceHydrationPlan(
  snapshot: unknown,
): WorkspaceHydrationPlan {
  const record = isRecord(snapshot) ? snapshot : null;
  const researchResults = isRecord(record?.researchResults)
    ? record.researchResults
    : null;
  const viewSections = getViewHydrationSections(record?.view);

  return {
    sections:
      viewSections.length > 0
        ? viewSections
        : getFallbackHydrationSections(researchResults),
    cardEdits: getCardEdits(researchResults),
  };
}
