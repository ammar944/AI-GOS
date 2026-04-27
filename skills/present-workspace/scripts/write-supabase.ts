import type { PresentWorkspaceInput } from "../schemas/input.ts";
import type {
  CardWriteResult,
  ResearchResultEnvelope,
  SupabaseWrite,
  WorkspaceCard,
} from "../schemas/output.ts";

export interface SupabaseWriteInput {
  userId: string;
  runId: string;
  sectionKey: PresentWorkspaceInput["section_key"];
  result: ResearchResultEnvelope;
  cards: WorkspaceCard[];
  cardResults: CardWriteResult[];
  idempotencyKey: string;
}

export interface SupabaseWriteReceipt {
  outcome: "dry_run" | "mock_written";
  writeHappened: boolean;
  warnings: string[];
  updatedAt: string;
}

export interface SupabaseWriteTransport {
  kind: "dry-run" | "mock-write";
  writeResearchResult(input: SupabaseWriteInput): Promise<SupabaseWriteReceipt>;
}

export function createIdempotencyKey(params: {
  runId: string;
  sectionKey: string;
  briefSnapshotId?: string;
  cardIds: string[];
}): string {
  const sortedCardIds = [...params.cardIds].sort().join("|") || "no-cards";
  return [
    "present-workspace",
    params.runId,
    params.sectionKey,
    params.briefSnapshotId ?? "no-brief",
    sortedCardIds,
  ].join(":");
}

export function createDryRunTransport(): SupabaseWriteTransport {
  return {
    kind: "dry-run",
    async writeResearchResult(): Promise<SupabaseWriteReceipt> {
      return {
        outcome: "dry_run",
        writeHappened: false,
        warnings: ["dry-run transport: no Supabase network call was made"],
        updatedAt: new Date().toISOString(),
      };
    },
  };
}

export function createMockWriteTransport(): SupabaseWriteTransport {
  return {
    kind: "mock-write",
    async writeResearchResult(): Promise<SupabaseWriteReceipt> {
      return {
        outcome: "mock_written",
        writeHappened: true,
        warnings: ["mock-write transport: write contract exercised without Supabase client"],
        updatedAt: new Date().toISOString(),
      };
    },
  };
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function writeWorkspaceEnvelope(params: {
  input: PresentWorkspaceInput;
  envelope: ResearchResultEnvelope;
  cards: WorkspaceCard[];
  cardResults: CardWriteResult[];
  idempotencyKey: string;
  transport: SupabaseWriteTransport;
  maxRetries?: number;
}): Promise<SupabaseWrite> {
  const maxRetries = params.maxRetries ?? 3;
  let lastError: unknown;
  const warnings: string[] = [];

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const receipt = await params.transport.writeResearchResult({
        userId: params.input.user_id,
        runId: params.input.run_id,
        sectionKey: params.input.section_key,
        result: params.envelope,
        cards: params.cards,
        cardResults: params.cardResults,
        idempotencyKey: params.idempotencyKey,
      });

      return {
        table: "journey_sessions",
        user_id: params.input.user_id,
        run_id: params.input.run_id,
        section_key: params.input.section_key,
        result_status: params.envelope.status,
        transport: params.transport.kind,
        wrote_research_results: receipt.writeHappened,
        wrote_research_document: false,
        write_happened: receipt.writeHappened,
        outcome: receipt.outcome,
        updated_at: receipt.updatedAt,
        idempotency_key: params.idempotencyKey,
        card_results: params.cardResults.map((result) => ({
          ...result,
          outcome: receipt.outcome,
        })),
        warnings: [...warnings, ...receipt.warnings],
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        warnings.push(
          `write retry ${attempt}/${maxRetries} failed for run_id=${params.input.run_id} section_key=${params.input.section_key}: ${formatUnknownError(error)}`,
        );
      }
    }
  }

  throw new Error(
    [
      "Supabase write contract failed",
      `run_id=${params.input.run_id}`,
      `section_key=${params.input.section_key}`,
      "table=journey_sessions",
      "operation=merge_research_result",
      "status=error",
      `last_error=${formatUnknownError(lastError)}`,
    ].join(" "),
  );
}
