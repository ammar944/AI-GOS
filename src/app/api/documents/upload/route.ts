// POST /api/documents/upload
// Parses uploaded documents, classifies by section relevance, and persists
// parsed markdown to business_profile_documents for runner context injection.
//
// Reuses the existing parseDocument utility (pdf-parse, mammoth, text).
// No LLM calls — classification is keyword-based (fast, free, deterministic).

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { parseDocument } from '@/lib/company-intel/document-parser';
import { ACCEPTED_MIME_TYPES } from '@/lib/company-intel/document-types';
import { estimateTokenCount } from '@/lib/documents/token-count';
import { classifyDocumentSections } from '@/lib/documents/section-tagger';
import { createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const MAX_FILES_PER_REQUEST = 10;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB per file (docx/pdf embed images; mammoth/pdf-parse extract text only)
const MAX_TOTAL_TOKENS = 50_000;

const BUCKET = 'document-uploads';

interface FileInput {
  fileBase64?: string;
  storagePath?: string;
  fileName: string;
  mimeType: string;
}

interface StoredDocument {
  id: string;
  fileName: string;
  docKind: string;
  sectionTags: string[];
  tokenCount: number;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { files?: FileInput[]; businessProfileId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { files, businessProfileId } = body;

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json(
      { error: 'files array is required and must not be empty' },
      { status: 400 },
    );
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES_PER_REQUEST} files per request` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const stored: StoredDocument[] = [];
  const errors: string[] = [];
  let totalTokens = 0;

  for (const file of files) {
    const { fileBase64, storagePath, fileName, mimeType } = file;

    // Validate required fields
    if ((!fileBase64 && !storagePath) || !fileName || !mimeType) {
      errors.push(`${fileName ?? 'unknown'}: missing required fields`);
      continue;
    }

    // Normalize MIME
    const normalizedMime =
      mimeType === 'text/x-markdown' ? 'text/markdown' : mimeType;

    // Validate MIME type (allow octet-stream since browsers report it for .docx)
    if (!ACCEPTED_MIME_TYPES.includes(normalizedMime) && normalizedMime !== 'application/octet-stream') {
      errors.push(`${fileName}: unsupported file type ${mimeType}`);
      continue;
    }

    // Resolve base64 — either from payload directly or by downloading from storage
    let resolvedBase64: string;
    let estimatedBytes: number;

    if (storagePath) {
      // Download from Supabase Storage (bypasses Vercel body limit)
      try {
        const { data: blob, error: dlError } = await supabase.storage
          .from(BUCKET)
          .download(storagePath);
        if (dlError || !blob) {
          errors.push(`${fileName}: failed to download from storage`);
          continue;
        }
        const arrayBuffer = await blob.arrayBuffer();
        estimatedBytes = arrayBuffer.byteLength;
        if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
          errors.push(`${fileName}: exceeds 15MB limit`);
          continue;
        }
        resolvedBase64 = Buffer.from(arrayBuffer).toString('base64');

        // Clean up storage — we only need the parsed text
        supabase.storage.from(BUCKET).remove([storagePath]).catch((err) => {
          console.warn(`[documents/upload] Storage cleanup failed for ${storagePath}:`, err);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Storage download failed';
        errors.push(`${fileName}: ${msg}`);
        continue;
      }
    } else {
      resolvedBase64 = fileBase64!;
      estimatedBytes = resolvedBase64.length * 0.75;
      if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
        errors.push(`${fileName}: exceeds 15MB limit`);
        continue;
      }
    }

    // Parse document to markdown
    let parsed;
    try {
      parsed = await parseDocument(resolvedBase64, fileName, normalizedMime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Parse failed';
      errors.push(`${fileName}: ${msg}`);
      continue;
    }

    // Reject empty documents
    if (parsed.wordCount < 10) {
      errors.push(`${fileName}: document appears empty or image-only`);
      continue;
    }

    // Token count + budget enforcement
    const tokenCount = estimateTokenCount(parsed.text);
    if (totalTokens + tokenCount > MAX_TOTAL_TOKENS) {
      errors.push(
        `${fileName}: skipped — would exceed ${MAX_TOTAL_TOKENS} total token budget`,
      );
      continue;
    }
    totalTokens += tokenCount;

    // Classify document sections + kind
    const { sectionTags, docKind } = classifyDocumentSections(
      parsed.text,
      fileName,
    );

    // Persist to Supabase
    try {
      const { data, error: dbError } = await supabase
        .from('business_profile_documents')
        .insert({
          user_id: userId,
          business_profile_id: businessProfileId ?? null,
          file_name: fileName,
          mime_type: normalizedMime,
          file_size_bytes: Math.round(estimatedBytes),
          parsed_markdown: parsed.text,
          section_tags: sectionTags,
          doc_kind: docKind,
          token_count: tokenCount,
        })
        .select('id')
        .single();

      if (dbError) {
        console.error(`[documents/upload] DB error for ${fileName}:`, dbError);
        errors.push(`${fileName}: storage failed`);
        continue;
      }

      stored.push({
        id: data.id,
        fileName,
        docKind,
        sectionTags,
        tokenCount,
      });
    } catch (err) {
      console.error(`[documents/upload] Unexpected error for ${fileName}:`, err);
      errors.push(`${fileName}: storage failed`);
    }
  }

  return NextResponse.json({
    documents: stored,
    totalTokens,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
