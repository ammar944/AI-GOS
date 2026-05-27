'use client';

import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react';
import { FileUp, Loader2, Mic, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ACCEPTED_FILE_EXTENSIONS } from '@/lib/company-intel/document-types';
import {
  uploadedDocumentUploadResponseSchema,
  type UploadedDocumentContext,
} from '@/lib/research-v2/uploaded-document-context';

interface WelcomeFormProps {
  onSubmit: (
    url: string,
    uploadedDocuments: UploadedDocumentContext[],
  ) => Promise<void>;
  isLoading?: boolean;
}

interface PreparedFileInput {
  fileBase64?: string;
  storagePath?: string;
  fileName: string;
  mimeType: string;
}

const MAX_ENTRY_FILES = 10;
const AUDIO_FILE_EXTENSIONS = '.webm,.ogg,.mp4,.mp3,.mpeg,.wav,.flac,.m4a';
const ENTRY_FILE_ACCEPT = `${ACCEPTED_FILE_EXTENSIONS},${AUDIO_FILE_EXTENSIONS}`;
const AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/flac',
  'audio/x-m4a',
]);
const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
};
const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  flac: 'audio/flac',
  m4a: 'audio/x-m4a',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  mpeg: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm',
};

function parseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  try {
    new URL(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readStringField(
  value: Record<string, unknown>,
  field: string,
  context: string,
): string {
  const candidate = value[field];
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    throw new Error(`${context} response missing ${field}`);
  }

  return candidate;
}

async function readJsonResponse(
  response: Response,
  context: string,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} returned invalid JSON: ${message}`);
  }
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = await response.json();
    if (isRecord(payload) && typeof payload.error === 'string') {
      return payload.error;
    }
  } catch {
    // Keep the HTTP status fallback below when an error response is not JSON.
  }

  return `${fallback} (HTTP ${response.status})`;
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function inferMimeType(file: File): string {
  const extension = getFileExtension(file.name);
  const extensionMime =
    DOCUMENT_MIME_BY_EXTENSION[extension] ?? AUDIO_MIME_BY_EXTENSION[extension];

  if (extensionMime) {
    return extensionMime;
  }

  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }

  return 'application/octet-stream';
}

function isAudioMimeType(mimeType: string): boolean {
  return AUDIO_MIME_TYPES.has(mimeType);
}

function isDocumentMimeType(mimeType: string): boolean {
  return Object.values(DOCUMENT_MIME_BY_EXTENSION).includes(mimeType);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function textToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error(`Failed to read ${file.name} as base64`));
        return;
      }

      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => {
      reject(new Error(`Failed to read ${file.name}`));
    };
    reader.readAsDataURL(file);
  });
}

async function requestSignedUpload(
  file: File,
  mimeType: string,
): Promise<{ signedUrl: string; storagePath: string }> {
  const response = await fetch('/api/documents/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to prepare ${file.name}`),
    );
  }

  const payload = await readJsonResponse(response, 'Signed upload');
  if (!isRecord(payload)) {
    throw new Error('Signed upload response was not an object');
  }

  return {
    signedUrl: readStringField(payload, 'signedUrl', 'Signed upload'),
    storagePath: readStringField(payload, 'storagePath', 'Signed upload'),
  };
}

async function uploadFileToStorage(
  file: File,
  mimeType: string,
  signedUrl: string,
): Promise<void> {
  const response = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType, 'x-upsert': 'true' },
    body: file,
  });

  if (!response.ok) {
    throw new Error(
      `Storage upload failed for ${file.name} (HTTP ${response.status})`,
    );
  }
}

function transcriptFileName(fileName: string): string {
  const extension = getFileExtension(fileName);
  const basename = extension
    ? fileName.slice(0, -(extension.length + 1))
    : fileName;

  return `${basename || 'audio'}.transcript.txt`;
}

async function transcribeAudioFile(
  file: File,
  mimeType: string,
): Promise<string> {
  const audioBase64 = await fileToBase64(file);
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ audioBase64, mimeType }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to transcribe ${file.name}`),
    );
  }

  const payload = await readJsonResponse(response, 'Transcription');
  if (!isRecord(payload)) {
    throw new Error('Transcription response was not an object');
  }

  return readStringField(payload, 'text', 'Transcription');
}

async function prepareDocumentFile(file: File): Promise<PreparedFileInput> {
  const mimeType = inferMimeType(file);
  if (!isDocumentMimeType(mimeType)) {
    throw new Error(`${file.name}: unsupported document type`);
  }

  const { signedUrl, storagePath } = await requestSignedUpload(file, mimeType);
  await uploadFileToStorage(file, mimeType, signedUrl);

  return {
    fileName: file.name,
    mimeType,
    storagePath,
  };
}

async function prepareAudioFile(file: File): Promise<PreparedFileInput> {
  const mimeType = inferMimeType(file);
  if (!isAudioMimeType(mimeType)) {
    throw new Error(`${file.name}: unsupported audio type`);
  }

  const transcript = await transcribeAudioFile(file, mimeType);

  return {
    fileBase64: textToBase64(transcript),
    fileName: transcriptFileName(file.name),
    mimeType: 'text/plain',
  };
}

async function prepareEntryFile(file: File): Promise<PreparedFileInput> {
  const mimeType = inferMimeType(file);

  if (isAudioMimeType(mimeType)) {
    return prepareAudioFile(file);
  }

  return prepareDocumentFile(file);
}

async function uploadEntryFiles(
  files: readonly File[],
  onStatusChange: (status: string) => void,
): Promise<UploadedDocumentContext[]> {
  if (files.length === 0) {
    return [];
  }

  if (files.length > MAX_ENTRY_FILES) {
    throw new Error(`Select ${MAX_ENTRY_FILES} files or fewer`);
  }

  const preparedFiles: PreparedFileInput[] = [];
  for (const [index, file] of files.entries()) {
    onStatusChange(`Preparing ${index + 1}/${files.length}: ${file.name}`);
    preparedFiles.push(await prepareEntryFile(file));
  }

  onStatusChange('Persisting parsed context');
  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ files: preparedFiles }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to persist uploaded documents'),
    );
  }

  const payload = uploadedDocumentUploadResponseSchema.parse(
    await readJsonResponse(response, 'Document upload'),
  );

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(`Document upload failed: ${payload.errors.join('; ')}`);
  }

  if (payload.documents.length !== files.length) {
    throw new Error(
      `Document upload persisted ${payload.documents.length}/${files.length} files`,
    );
  }

  return payload.documents;
}

export function WelcomeForm({
  onSubmit,
  isLoading = false,
}: WelcomeFormProps): ReactElement {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isLoading || isUploading;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextFiles = Array.from(event.currentTarget.files ?? []);
    setFiles(nextFiles);
    setError(null);
    setUploadStatus(null);
  }

  function handleRemoveFile(index: number): void {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setUploadStatus(null);
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setUploadStatus(null);

    const url = parseUrl(value);
    if (!url) {
      setError('Please enter a valid company URL');
      return;
    }

    try {
      setIsUploading(files.length > 0);
      const uploadedDocuments = await uploadEntryFiles(files, setUploadStatus);
      await onSubmit(url, uploadedDocuments);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Failed to prepare uploaded context',
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Pre-Pitch Positioning Audit
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a company URL and attach supporting context before research starts.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="https://your-company.com"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              disabled={isBusy}
              className={cn(
                'h-11 rounded-md text-sm',
                error && 'border-destructive focus-visible:ring-destructive',
              )}
              autoFocus
              aria-label="Company URL"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ENTRY_FILE_ACCEPT}
              className="sr-only"
              onChange={handleFileChange}
              disabled={isBusy}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-center rounded-md"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="size-4" />
              Add context files
            </Button>

            {files.length > 0 && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-2">
                {files.map((file, index) => {
                  const mimeType = inferMimeType(file);
                  const Icon = isAudioMimeType(mimeType) ? Mic : FileUp;

                  return (
                    <div
                      key={`${file.name}-${file.lastModified}`}
                      className="flex min-h-10 items-center gap-2 rounded-sm px-2 text-sm"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${file.name}`}
                        disabled={isBusy}
                        onClick={() => handleRemoveFile(index)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {uploadStatus && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {uploadStatus}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="h-11 w-full rounded-md"
            disabled={isBusy || !value.trim()}
          >
            {isBusy ? 'Starting research...' : 'Start research'}
          </Button>
        </form>
      </div>
    </div>
  );
}
