import { z } from "zod";

export const MAX_UPLOADED_DOCUMENT_CONTEXT_CHARS = 30_000;
export const MAX_UPLOADED_DOCUMENT_EXCERPT_CHARS = 48_000;

export const uploadedDocumentReferenceSchema = z
  .object({
    id: z.string().min(1),
    fileName: z.string().min(1),
    docKind: z.string().min(1),
    sectionTags: z.array(z.string().min(1)),
    tokenCount: z.number().int().nonnegative(),
    uploadedDocPath: z.string().min(1).nullable().optional(),
  })
  .strict();

export const uploadedDocumentContextSchema =
  uploadedDocumentReferenceSchema.extend({
    parsedMarkdown: z.string().min(1),
  });

export const uploadedDocumentUploadResponseSchema = z
  .object({
    documents: z.array(uploadedDocumentContextSchema),
    totalTokens: z.number().nonnegative(),
    errors: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type UploadedDocumentReference = z.infer<
  typeof uploadedDocumentReferenceSchema
>;
export type UploadedDocumentContext = z.infer<
  typeof uploadedDocumentContextSchema
>;
export type UploadedDocumentUploadResponse = z.infer<
  typeof uploadedDocumentUploadResponseSchema
>;

export interface UploadedDocumentMetadata {
  uploadedDocuments: UploadedDocumentReference[];
  uploadedDocIds: string[];
  uploadedDocPaths: string[];
}

function normalizeDocumentText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function limitText(value: string, maxChars: number): string {
  const normalized = normalizeDocumentText(value);

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars).trimEnd()}\n\n[truncated]`;
}

export function toUploadedDocumentReferences(
  documents: readonly UploadedDocumentContext[],
): UploadedDocumentReference[] {
  return documents.map(
    ({
      docKind,
      fileName,
      id,
      sectionTags,
      tokenCount,
      uploadedDocPath,
    }): UploadedDocumentReference => ({
      id,
      fileName,
      docKind,
      sectionTags,
      tokenCount,
      ...(uploadedDocPath ? { uploadedDocPath } : {}),
    }),
  );
}

export function buildUploadedDocumentMetadata(
  documents: readonly UploadedDocumentContext[],
): UploadedDocumentMetadata {
  const references = toUploadedDocumentReferences(documents);

  return {
    uploadedDocuments: references,
    uploadedDocIds: references.map((document) => document.id),
    uploadedDocPaths: references.flatMap((document) =>
      document.uploadedDocPath ? [document.uploadedDocPath] : [],
    ),
  };
}

export function buildUploadedDocumentContextBlock(
  documents: readonly UploadedDocumentContext[],
): string | null {
  if (documents.length === 0) {
    return null;
  }

  const blocks = documents.map((document, index) => {
    const tags =
      document.sectionTags.length > 0
        ? document.sectionTags.join(", ")
        : "unclassified";
    const text = limitText(
      document.parsedMarkdown,
      Math.max(
        1_000,
        Math.floor(MAX_UPLOADED_DOCUMENT_CONTEXT_CHARS / documents.length),
      ),
    );

    return [
      `### Uploaded document ${index + 1}: ${document.fileName}`,
      `kind: ${document.docKind}`,
      `sectionTags: ${tags}`,
      `tokens: ${document.tokenCount}`,
      "",
      text,
    ].join("\n");
  });

  return ["## Uploaded documents", ...blocks].join("\n\n");
}

export function buildUploadedDocumentSourceUrl(documentId: string): string {
  return `https://app.ai-gos.local/uploaded-documents/${encodeURIComponent(documentId)}`;
}

export function trimUploadedDocumentExcerpt(value: string): string {
  return limitText(value, MAX_UPLOADED_DOCUMENT_EXCERPT_CHARS);
}

export function getUploadedDocumentIdsFromMetadata(
  metadata: Record<string, unknown> | null,
): string[] {
  if (!metadata) {
    return [];
  }

  const references = metadata.uploadedDocuments;
  if (references !== undefined) {
    return z
      .array(uploadedDocumentReferenceSchema)
      .parse(references)
      .map((document) => document.id);
  }

  const uploadedDocIds = metadata.uploadedDocIds;
  if (uploadedDocIds === undefined) {
    return [];
  }

  return z.array(z.string().min(1)).parse(uploadedDocIds);
}
