import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { presentWorkspaceInputSchema, type PresentWorkspaceInput } from "../schemas/input.ts";
import {
  presentWorkspaceOutputSchema,
  type PresentWorkspaceOutput,
  type ResearchResultEnvelope,
} from "../schemas/output.ts";
import { applyCardEdits } from "./apply-card-edits.ts";
import { mapWorkspaceCards } from "./map-cards.ts";
import {
  createDryRunTransport,
  createIdempotencyKey,
  createMockWriteTransport,
  writeWorkspaceEnvelope,
} from "./write-supabase.ts";

function readJson(pathname: string): unknown {
  return JSON.parse(fs.readFileSync(pathname, "utf-8"));
}

function resolveInputPath(argument: string | undefined): string {
  const target = argument ?? "example";
  const stats = fs.statSync(target);
  if (stats.isDirectory()) {
    return path.join(target, "input.json");
  }
  return target;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function createResearchResultEnvelope(params: {
  input: PresentWorkspaceInput;
  data: Record<string, unknown>;
  cardEditsOverlay: Record<string, Record<string, unknown>>;
}): ResearchResultEnvelope {
  return {
    status: "complete",
    section: params.input.section_key,
    data: params.data,
    durationMs: 0,
    ...(Object.keys(params.cardEditsOverlay).length > 0
      ? { __cardEdits: params.cardEditsOverlay }
      : {}),
  };
}

export async function orchestrate(input: PresentWorkspaceInput): Promise<PresentWorkspaceOutput> {
  const mappedCards = mapWorkspaceCards(input);
  const idempotencyKey = createIdempotencyKey({
    runId: input.run_id,
    sectionKey: input.section_key,
    briefSnapshotId: input.brief_snapshot_id,
    cardIds: mappedCards.map((card) => card.id),
  });

  const outcome = input.write_mode === "mock-write" ? "mock_written" : "dry_run";
  const edited = applyCardEdits({
    cards: mappedCards,
    edits: input.card_edits,
    existingCards: input.existing_cards,
    outcome,
    idempotencyKey,
  });

  const envelope = createResearchResultEnvelope({
    input,
    data: {
      cards: edited.cards,
    },
    cardEditsOverlay: edited.cardEditsOverlay,
  });

  const transport =
    input.write_mode === "mock-write" ? createMockWriteTransport() : createDryRunTransport();

  const write = await writeWorkspaceEnvelope({
    input,
    envelope,
    cards: edited.cards,
    cardResults: edited.cardResults,
    idempotencyKey,
    transport,
  });

  const warnings = [
    "Output schema intentionally extends the spec sketch with card_kind, content snapshots, write outcome, and idempotency_key.",
    ...write.warnings,
  ];

  return presentWorkspaceOutputSchema.parse({
    run_id: input.run_id,
    ...(input.brief_snapshot_id ? { brief_snapshot_id: input.brief_snapshot_id } : {}),
    stage: "present-workspace",
    section_key: input.section_key,
    cards: edited.cards.map((card) => ({
      ...card,
      content: cloneRecord(card.content),
    })),
    research_result_envelope: envelope,
    write,
    warnings,
    generated_at: write.updated_at,
  });
}

async function main(): Promise<void> {
  const inputPath = resolveInputPath(process.argv[2]);
  const parsed = presentWorkspaceInputSchema.safeParse(readJson(inputPath));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    throw new Error(`Input schema validation failed for ${inputPath}: ${issues}`);
  }

  const output = await orchestrate(parsed.data);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[present-workspace] ${message}\n`);
    process.exit(1);
  });
}
