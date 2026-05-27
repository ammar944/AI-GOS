import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";
import {
  getUploadedDocumentIdsFromMetadata,
  uploadedDocumentContextSchema,
  type UploadedDocumentContext,
} from "./uploaded-document-context";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

const businessProfileDocumentRowSchema = z
  .object({
    id: z.string().min(1),
    file_name: z.string().min(1),
    doc_kind: z.string().min(1).nullable(),
    section_tags: z.array(z.string().min(1)).nullable(),
    token_count: z.number().int().nonnegative().nullable(),
    parsed_markdown: z.string().min(1).nullable(),
  })
  .strict();

function toUploadedDocumentContext(
  row: z.infer<typeof businessProfileDocumentRowSchema>,
): UploadedDocumentContext {
  if (!row.parsed_markdown) {
    throw new Error(
      `Uploaded document ${row.id} (${row.file_name}) is missing parsed_markdown`,
    );
  }

  return uploadedDocumentContextSchema.parse({
    id: row.id,
    fileName: row.file_name,
    docKind: row.doc_kind ?? "unknown",
    sectionTags: row.section_tags ?? [],
    tokenCount: row.token_count ?? 0,
    parsedMarkdown: row.parsed_markdown,
  });
}

export async function loadUploadedDocumentContextsForSession({
  metadata,
  supabase,
  userId,
}: {
  metadata: Record<string, unknown> | null;
  supabase: SupabaseAdminClient;
  userId: string;
}): Promise<UploadedDocumentContext[]> {
  const documentIds = getUploadedDocumentIdsFromMetadata(metadata);
  if (documentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("business_profile_documents")
    .select(
      "id,file_name,doc_kind,section_tags,token_count,parsed_markdown",
    )
    .eq("user_id", userId)
    .in("id", documentIds);

  if (error) {
    throw new Error(
      `Failed to load uploaded documents for user ${userId}: ${error.message}`,
    );
  }

  const rows = z.array(businessProfileDocumentRowSchema).parse(data ?? []);
  const rowById = new Map(rows.map((row) => [row.id, row]));

  return documentIds.map((documentId) => {
    const row = rowById.get(documentId);
    if (!row) {
      throw new Error(
        `Uploaded document ${documentId} referenced in session metadata was not found for user ${userId}`,
      );
    }

    return toUploadedDocumentContext(row);
  });
}
