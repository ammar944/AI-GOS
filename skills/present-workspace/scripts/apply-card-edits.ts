import type { CardEdit, WorkspaceCardInput } from "../schemas/input.ts";
import type { CardWriteResult, WorkspaceCard } from "../schemas/output.ts";

type JsonRecord = Record<string, unknown>;

export interface EditApplicationResult {
  cards: WorkspaceCard[];
  cardEditsOverlay: Record<string, JsonRecord>;
  cardResults: CardWriteResult[];
}

function cloneRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function findExistingCard(
  cardId: string,
  existingCards: WorkspaceCardInput[] | undefined,
): WorkspaceCardInput | null {
  return existingCards?.find((card) => card.id === cardId) ?? null;
}

export function applyCardEdits(params: {
  cards: WorkspaceCard[];
  edits: Record<string, CardEdit> | undefined;
  existingCards: WorkspaceCardInput[] | undefined;
  outcome: CardWriteResult["outcome"];
  idempotencyKey: string;
}): EditApplicationResult {
  const edits = params.edits ?? {};
  const cardEditsOverlay: Record<string, JsonRecord> = {};

  const cards = params.cards.map((card) => {
    const edit = edits[card.id];
    if (!edit) {
      return { ...card, content: cloneRecord(card.content) };
    }

    const updatedContent = cloneRecord(edit.updated_content);
    cardEditsOverlay[card.id] = updatedContent;

    return {
      ...card,
      content: updatedContent,
      status: "edited" as const,
    };
  });

  const cardResults = cards.map((card) => {
    const edit = edits[card.id];
    const existing = findExistingCard(card.id, params.existingCards);
    const priorContent = existing?.content ?? (edit ? params.cards.find((candidate) => candidate.id === card.id)?.content : null);

    return {
      run_id: card.run_id,
      ...(card.brief_snapshot_id ? { brief_snapshot_id: card.brief_snapshot_id } : {}),
      section_key: card.section_key,
      card_id: card.id,
      card_kind: card.card_kind,
      prior_content_snapshot: priorContent ? cloneRecord(priorContent) : null,
      new_content_snapshot: cloneRecord(card.content),
      outcome: params.outcome,
      idempotency_key: params.idempotencyKey,
    };
  });

  return {
    cards,
    cardEditsOverlay,
    cardResults,
  };
}
