// POST /api/onboarding/extract-document
// Parses uploaded documents (PDF/DOCX/TXT) and streams structured field extraction
// using Claude Haiku via streamObject. Uses a custom error-forwarding stream instead
// of toTextStreamResponse() which silently drops API errors.

import { streamObject } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { anthropic, MODELS } from '@/lib/ai/providers';
import { documentExtractionSchema } from '@/lib/company-intel/document-extraction-schema';
import { parseDocument } from '@/lib/company-intel/document-parser';
import { DOCUMENT_TYPE_CONFIG, type DocumentType } from '@/lib/company-intel/document-types';

export const maxDuration = 120;

const SYSTEM_PROMPTS: Record<DocumentType, string> = {
  niche_demographic: `You are a precise document analyst extracting structured business data from a Niche & Demographic Document — a strategic document covering the company's ICP, market positioning, competitive landscape, and brand identity.

RULES:
1. ONLY extract what is EXPLICITLY stated — NEVER fabricate or infer
2. If a field is not in the document, use EMPTY STRING ""
3. Condense long passages to 2-5 sentences, preserving key details and terminology
4. For enum fields, map to EXACT values in field descriptions (e.g., "solo", "1-10", "referrals")
5. For number fields, extract as plain number strings (e.g., "997", "15000")
6. This document likely has rich ICP, market, competition, and positioning data — extract thoroughly
7. Budget and compliance fields are less likely — use empty string if absent`,

  client_briefing: `You are a precise document analyst extracting structured business data from a Client Briefing Sheet — an execution-focused document covering budget, targets, assets, compliance details, and campaign specifics.

RULES:
1. ONLY extract what is EXPLICITLY stated — NEVER fabricate or infer
2. If a field is not in the document, use EMPTY STRING ""
3. Condense long passages to 2-5 sentences, preserving key details and terminology
4. For enum fields, map to EXACT values in field descriptions (e.g., "ongoing", "monthly")
5. For number fields, extract as plain number strings (e.g., "997", "15000")
6. This document likely has rich budget, targets, assets, and compliance data — extract thoroughly
7. ICP and competitive details are less likely — use empty string if absent`,
};

function isValidDocumentType(type: string): type is DocumentType {
  return type in DOCUMENT_TYPE_CONFIG;
}

export async function POST(request: Request) {
  console.log('[extract-document] Route handler invoked');

  const { userId } = await auth();
  if (!userId) {
    console.log('[extract-document] Unauthorized — no userId');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: {
    fileName?: string;
    mimeType?: string;
    fileBase64?: string;
    documentType?: string;
  };
  try {
    body = await request.json();
    console.log('[extract-document] Body parsed OK, keys:', Object.keys(body));
  } catch (parseError) {
    console.error('[extract-document] Failed to parse JSON body:', parseError);
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { fileName, mimeType, fileBase64, documentType } = body;

  // Validate required fields
  if (!fileName || !mimeType || !fileBase64 || !documentType) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: fileName, mimeType, fileBase64, documentType' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Validate document type
  if (!isValidDocumentType(documentType)) {
    return new Response(
      JSON.stringify({ error: `Invalid documentType. Must be: ${Object.keys(DOCUMENT_TYPE_CONFIG).join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const config = DOCUMENT_TYPE_CONFIG[documentType];

  // Normalize non-standard MIME variants (e.g., text/x-markdown → text/markdown)
  const normalizedMimeType = mimeType === 'text/x-markdown' ? 'text/markdown' : mimeType;

  // Validate MIME type
  if (!config.acceptedMimeTypes.includes(normalizedMimeType)) {
    return new Response(
      JSON.stringify({ error: `Unsupported file type: ${mimeType}. Accepted: ${config.acceptedExtensions.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Validate file size (base64 is ~33% larger than binary)
  const estimatedBytes = fileBase64.length * 0.75;
  if (estimatedBytes > config.maxFileSizeBytes) {
    const maxMB = (config.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
    return new Response(
      JSON.stringify({ error: `File too large. Maximum size: ${maxMB}MB` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Parse the document
  let parsed;
  try {
    parsed = await parseDocument(fileBase64, fileName, normalizedMimeType);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse document';
    return new Response(
      JSON.stringify({ error: `Document parsing failed: ${message}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Reject empty/image-only documents
  if (parsed.wordCount < 10) {
    return new Response(
      JSON.stringify({ error: 'Document appears to be empty or image-only. Please upload a text-based document.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  console.log(
    `[extract-document] Parsed ${fileName} (${documentType}): ${parsed.wordCount} words` +
    (parsed.pageCount ? `, ${parsed.pageCount} pages` : '') +
    `, text length: ${parsed.text.length} chars`,
  );

  // Build user prompt with full document text
  const userPrompt = `Extract all relevant business information from this ${config.label}.

Document: "${fileName}"
${parsed.pageCount ? `Pages: ${parsed.pageCount}` : ''}
Word count: ${parsed.wordCount}

--- DOCUMENT CONTENT ---
${parsed.text}
--- END DOCUMENT ---

Extract every field you can find. Use empty string "" for fields not in this document.
Be thorough — this document may contain information spread across many sections.`;

  // Stream structured extraction using Haiku (fast, cheap, excellent at extraction).
  // We use fullStream + a custom ReadableStream instead of toTextStreamResponse()
  // because the latter silently drops error chunks, causing the client to get an
  // empty 200 response and get stuck when the API fails.
  try {
    const startMs = Date.now();
    console.log('[extract-document] Starting streamObject with Claude Haiku...');
    const result = streamObject({
      model: anthropic(MODELS.CLAUDE_HAIKU),
      schema: documentExtractionSchema,
      system: SYSTEM_PROMPTS[documentType],
      prompt: userPrompt,
      temperature: 0.1,
      maxOutputTokens: 12000,
    });

    // Log usage in background
    result.usage
      .then((u) => console.log(`[extract-document] Done in ${Date.now() - startMs}ms. Usage:`, JSON.stringify(u)))
      .catch(() => {});

    // Build a custom stream that forwards errors instead of dropping them.
    // experimental_useObject's fetch reader will catch the stream error
    // and surface it via the hook's `error` / `onError`.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.fullStream) {
            if (chunk.type === 'text-delta') {
              controller.enqueue(encoder.encode(chunk.textDelta));
            } else if (chunk.type === 'error') {
              const msg = chunk.error instanceof Error ? chunk.error.message : 'Stream error';
              console.error('[extract-document] API error forwarded to client:', msg);
              controller.error(new Error(msg));
              return;
            }
          }
          console.log(`[extract-document] Stream completed in ${Date.now() - startMs}ms`);
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error('[extract-document] Stream iteration error:', msg);
          controller.error(err instanceof Error ? err : new Error(msg));
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('[extract-document] streamObject failed:', error);
    const message = error instanceof Error ? error.message : 'AI extraction failed';
    return new Response(
      JSON.stringify({ error: `Extraction failed: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
