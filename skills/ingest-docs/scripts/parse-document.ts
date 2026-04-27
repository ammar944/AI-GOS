/**
 * Portable local parser for ingest-docs fixtures.
 */
import * as fs from "fs";
import * as path from "path";
import {
  MAX_FILE_SIZE_BYTES,
  MIN_WORD_COUNT,
  normalizeMimeType,
  type IngestDocumentInput,
} from "../schemas/input.ts";

export interface ParsedDocument {
  documentId: string;
  fileName: string;
  mimeType: string;
  text: string;
  wordCount: number;
  pageCount?: number;
  sourceUrl: string;
  retrievedAt: string;
  fileSizeBytes: number;
}

const MAX_CHARS = 500_000;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function decodeBase64(fileBase64: string, fileName: string): Buffer {
  try {
    return Buffer.from(fileBase64, "base64");
  } catch (error) {
    const message = error instanceof Error ? error.message : "base64 decode failed";
    throw new Error(`Document ${fileName}: invalid file_base64 payload: ${message}`);
  }
}

function readStoragePath(storagePath: string, fileName: string): Buffer {
  if (/^https?:\/\//i.test(storagePath)) {
    throw new Error(
      `Document ${fileName}: HTTP storage_path resolution is not available in this local skill. Provide file_base64 for local fixtures.`,
    );
  }
  const resolvedPath = path.resolve(storagePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Document ${fileName}: storage_path does not exist: ${resolvedPath}`);
  }
  return fs.readFileSync(resolvedPath);
}

function parseBuffer(buffer: Buffer, fileName: string, mimeType: string): { text: string; pageCount?: number } {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return { text: buffer.toString("utf-8") };
  }
  if (mimeType === "application/pdf") {
    throw new Error(
      `Document ${fileName}: PDF parsing requires a skill-local parser dependency that is not installed. Convert the fixture to TXT or Markdown before running local ingest-docs.`,
    );
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    throw new Error(
      `Document ${fileName}: DOCX parsing requires a skill-local parser dependency that is not installed. Convert the fixture to TXT or Markdown before running local ingest-docs.`,
    );
  }
  throw new Error(`Document ${fileName}: unsupported MIME type ${mimeType}`);
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").slice(0, MAX_CHARS).trim();
}

function estimateSourceUrl(document: IngestDocumentInput): string {
  if (document.source_url) {
    return document.source_url;
  }
  if (document.storage_path?.startsWith("http")) {
    return document.storage_path;
  }
  throw new Error(
    `Document ${document.file_name}: source_url is required for sourced brief evidence`,
  );
}

export function parseDocumentInput(document: IngestDocumentInput, index: number): ParsedDocument {
  const mimeType = normalizeMimeType(document.mime_type);
  const buffer = document.file_base64
    ? decodeBase64(document.file_base64, document.file_name)
    : readStoragePath(document.storage_path ?? "", document.file_name);

  const fileSizeBytes = document.file_size_bytes ?? buffer.byteLength;
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Document ${document.file_name}: ${fileSizeBytes} bytes exceeds ${MAX_FILE_SIZE_BYTES} byte per-file limit`,
    );
  }

  const parsed = parseBuffer(buffer, document.file_name, mimeType);
  const text = normalizeText(parsed.text);
  const wordCount = countWords(text);
  if (wordCount < MIN_WORD_COUNT) {
    throw new Error(
      `Document ${document.file_name}: document appears empty or image-only; parsed ${wordCount} words, minimum is ${MIN_WORD_COUNT}`,
    );
  }

  return {
    documentId: document.document_id ?? `doc-${index + 1}`,
    fileName: document.file_name,
    mimeType,
    text,
    wordCount,
    pageCount: parsed.pageCount,
    sourceUrl: estimateSourceUrl(document),
    retrievedAt: document.retrieved_at ?? new Date().toISOString(),
    fileSizeBytes,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
