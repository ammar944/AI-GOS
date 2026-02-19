// Server-side document parser
// Extracts plain text from PDF, DOCX, TXT, and MD files
// Uses pdf-parse/lib/pdf-parse (bypasses index.js debug wrapper) and mammoth for DOCX

import type { ParsedDocument } from './document-types';

const MAX_CHARS = 500_000; // ~125k tokens, well within Claude's 200k context

export async function parseDocument(
  fileBase64: string,
  fileName: string,
  mimeType: string,
): Promise<ParsedDocument> {
  const buffer = Buffer.from(fileBase64, 'base64');

  let text: string;
  let pageCount: number | undefined;

  if (mimeType === 'application/pdf') {
    // Import the actual parser directly — index.js has a debug wrapper that
    // tries to read a test PDF file, which fails in bundled environments.
    // lib/pdf-parse.js is the clean parser with PDFJS.disableWorker = true.
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = pdfParseModule.default ?? pdfParseModule;
    const data = await pdfParse(buffer);
    text = data.text;
    pageCount = data.numpages;
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    text = buffer.toString('utf-8');
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  // Safety cap
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    text,
    pageCount,
    wordCount,
    fileName,
    fileType: mimeType,
  };
}
