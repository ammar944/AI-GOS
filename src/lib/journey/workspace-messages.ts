import type { UIMessage } from 'ai';
import { z } from 'zod';
import { WORKSPACE_SECTIONS } from '@/lib/workspace/pipeline';
import type { SectionKey } from '@/lib/workspace/types';

export const WORKSPACE_MESSAGES_SCHEMA_VERSION = 1;

export interface WorkspaceMessagesEnvelope {
  schemaVersion: typeof WORKSPACE_MESSAGES_SCHEMA_VERSION;
  workspace: Partial<Record<SectionKey, UIMessage[]>> & Record<string, UIMessage[]>;
}

export class WorkspaceMessagesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceMessagesValidationError';
  }
}

const uiMessageRoleSchema = z.enum(['system', 'user', 'assistant']);
const workspaceSectionSet = new Set<string>(WORKSPACE_SECTIONS);

const messagePartSchema = z
  .object({
    type: z.string().min(1),
  })
  .passthrough();

const uiMessageSchema = z
  .object({
    id: z.string().min(1),
    role: uiMessageRoleSchema,
    metadata: z.unknown().optional(),
    parts: z.array(messagePartSchema),
  })
  .passthrough();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value };
}

function sanitizeTextPart(part: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof part.text !== 'string') {
    return null;
  }

  if (part.state === 'streaming') {
    return null;
  }

  const nextPart = cloneRecord(part);
  if (part.state !== undefined) {
    nextPart.state = 'done';
  }
  return nextPart;
}

function sanitizeToolPart(part: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof part.toolCallId !== 'string' || part.toolCallId.trim().length === 0) {
    return null;
  }

  const state = typeof part.state === 'string' ? part.state : null;
  if (
    state !== 'output-available' &&
    state !== 'output-error' &&
    state !== 'output-denied'
  ) {
    return null;
  }

  return cloneRecord(part);
}

function sanitizeSourceUrlPart(part: Record<string, unknown>): Record<string, unknown> | null {
  return typeof part.sourceId === 'string' && typeof part.url === 'string'
    ? cloneRecord(part)
    : null;
}

function sanitizeSourceDocumentPart(part: Record<string, unknown>): Record<string, unknown> | null {
  return typeof part.sourceId === 'string' &&
    typeof part.mediaType === 'string' &&
    typeof part.title === 'string'
    ? cloneRecord(part)
    : null;
}

function sanitizeFilePart(part: Record<string, unknown>): Record<string, unknown> | null {
  return typeof part.mediaType === 'string' && typeof part.url === 'string'
    ? cloneRecord(part)
    : null;
}

function sanitizeDataPart(part: Record<string, unknown>): Record<string, unknown> | null {
  return 'data' in part ? cloneRecord(part) : null;
}

function sanitizeMessagePart(part: Record<string, unknown>): Record<string, unknown> | null {
  const type = part.type;

  if (type === 'reasoning') {
    return null;
  }

  if (type === 'text') {
    return sanitizeTextPart(part);
  }

  if (typeof type === 'string' && type.startsWith('tool-')) {
    return sanitizeToolPart(part);
  }

  if (type === 'dynamic-tool') {
    return sanitizeToolPart(part);
  }

  if (type === 'source-url') {
    return sanitizeSourceUrlPart(part);
  }

  if (type === 'source-document') {
    return sanitizeSourceDocumentPart(part);
  }

  if (type === 'file') {
    return sanitizeFilePart(part);
  }

  if (type === 'step-start') {
    return { type: 'step-start' };
  }

  if (typeof type === 'string' && type.startsWith('data-')) {
    return sanitizeDataPart(part);
  }

  return null;
}

function sanitizeMessage(candidate: unknown, index: number): UIMessage {
  const parsed = uiMessageSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new WorkspaceMessagesValidationError(
      `Invalid workspace message at index ${index}: ${parsed.error.message}`,
    );
  }

  const parts = parsed.data.parts
    .map((part) => sanitizeMessagePart(part))
    .filter((part): part is Record<string, unknown> => part !== null);

  if (parts.length === 0) {
    throw new WorkspaceMessagesValidationError(
      `Invalid workspace message at index ${index}: no persistable message parts`,
    );
  }

  return {
    id: parsed.data.id,
    role: parsed.data.role,
    ...(parsed.data.metadata === undefined ? {} : { metadata: parsed.data.metadata }),
    parts: parts as UIMessage['parts'],
  };
}

export function parseWorkspaceSection(value: unknown): SectionKey | null {
  return typeof value === 'string' && workspaceSectionSet.has(value)
    ? (value as SectionKey)
    : null;
}

export function serializeWorkspaceMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) {
    throw new WorkspaceMessagesValidationError('Workspace messages must be an array');
  }

  return value.map((message, index) => sanitizeMessage(message, index));
}

function readValidMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const messages: UIMessage[] = [];
  value.forEach((message, index) => {
    try {
      messages.push(sanitizeMessage(message, index));
    } catch {
      // Reads are defensive because old rows may contain partial UI states.
    }
  });

  return messages;
}

export function readWorkspaceMessagesBySection(
  value: unknown,
): Record<string, UIMessage[]> {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      WORKSPACE_SECTIONS.map((section) => [section, readValidMessages(value)]),
    );
  }

  if (!isRecord(value) || !isRecord(value.workspace)) {
    return {};
  }

  const entries = Object.entries(value.workspace).map(([section, messages]) => [
    section,
    readValidMessages(messages),
  ]);

  return Object.fromEntries(entries);
}

export function readWorkspaceSectionMessages(
  value: unknown,
  section: SectionKey,
): UIMessage[] {
  if (Array.isArray(value)) {
    return readValidMessages(value);
  }

  const bySection = readWorkspaceMessagesBySection(value);
  return bySection[section] ?? [];
}

export function mergeWorkspaceSectionMessages(
  currentValue: unknown,
  section: SectionKey,
  nextMessagesValue: unknown,
): WorkspaceMessagesEnvelope {
  const nextMessages = serializeWorkspaceMessages(nextMessagesValue);
  const currentBySection = readWorkspaceMessagesBySection(currentValue);

  return {
    schemaVersion: WORKSPACE_MESSAGES_SCHEMA_VERSION,
    workspace: {
      ...currentBySection,
      [section]: nextMessages,
    },
  };
}
