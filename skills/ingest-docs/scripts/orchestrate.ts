/**
 * Local deterministic orchestrator for ingest-docs.
 */
import * as fs from "fs";
import * as path from "path";
import { classifyDocument } from "./classify-document.ts";
import { estimateTokens, parseDocumentInput } from "./parse-document.ts";
import { normalizeDocuments } from "./normalize-fields.ts";
import {
  MAX_TOTAL_TOKENS,
  ingestDocsInputSchema,
  normalizeMimeType,
  type IngestDocsInput,
} from "../schemas/input.ts";
import { ingestDocsOutputSchema, type DocumentSource, type IngestDocsOutput } from "../schemas/output.ts";

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function resolveInputPath(arg: string | undefined): string {
  const target = arg ?? "example";
  const resolved = path.resolve(target);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return path.join(resolved, "input.json");
  }
  return resolved;
}

function validateInput(raw: unknown): IngestDocsInput {
  const parsed = ingestDocsInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    throw new Error(`Input validation failed: ${issues}`);
  }
  return parsed.data;
}

function toDocumentSource(parsedDocument: ReturnType<typeof parseDocumentInput>): DocumentSource {
  const classification = classifyDocument(parsedDocument.text, parsedDocument.fileName);
  return {
    document_id: parsedDocument.documentId,
    file_name: parsedDocument.fileName,
    mime_type: normalizeMimeType(parsedDocument.mimeType),
    doc_kind: classification.docKind,
    gtm_stage_tags: classification.gtmStageTags,
    word_count: parsedDocument.wordCount,
    page_count: parsedDocument.pageCount,
    source_url: parsedDocument.sourceUrl,
    retrieved_at: parsedDocument.retrievedAt,
  };
}

export function runIngestDocs(input: IngestDocsInput): IngestDocsOutput {
  const parsedDocuments = input.documents.map((document, index) =>
    parseDocumentInput(document, index),
  );
  const totalTokens = parsedDocuments.reduce(
    (sum, document) => sum + estimateTokens(document.text),
    0,
  );
  if (totalTokens > MAX_TOTAL_TOKENS) {
    throw new Error(
      `Run ${input.run_id}: parsed documents exceed ${MAX_TOTAL_TOKENS} token budget; estimated ${totalTokens}`,
    );
  }

  const normalized = normalizeDocuments(parsedDocuments);
  const output: IngestDocsOutput = {
    run_id: input.run_id,
    stage: "enrich-brief",
    documents: parsedDocuments.map(toDocumentSource),
    brief_fragment: normalized.briefFragment,
    field_catalog: normalized.fieldCatalog,
    conflicts: normalized.conflicts,
    unresolved_fields: normalized.unresolvedFields,
    generated_at: new Date().toISOString(),
  };

  const result = ingestDocsOutputSchema.safeParse(output);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    throw new Error(`Output validation failed after orchestration: ${issues}`);
  }
  return result.data;
}

function main(): void {
  const inputPath = resolveInputPath(process.argv[2]);
  const input = validateInput(readJson(inputPath));
  const output = runIngestDocs(input);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
