import type { IntentPatch } from './intent-router.types';

const DANGEROUS_TOKENS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Validates a JSONB patch path. Accepts dotted paths with optional bracket
 * indices (e.g. "keyFindings[0].evidence", "sources[2].url"). Rejects empty
 * paths, leading dot/bracket, and any path containing __proto__, constructor,
 * or prototype to block prototype pollution.
 */
export function isValidPath(path: string): boolean {
  if (!path) return false;
  if (path.startsWith('.') || path.startsWith('[')) return false;
  const segments = path.split(/[.\[\]]+/).filter(Boolean);
  if (segments.length === 0) return false;
  return !segments.some((seg) => DANGEROUS_TOKENS.has(seg));
}

interface PathToken {
  kind: 'key' | 'index';
  value: string | number;
}

function tokenize(path: string): PathToken[] {
  const tokens: PathToken[] = [];
  const re = /([^.\[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    if (match[2] !== undefined) {
      tokens.push({ kind: 'index', value: Number(match[2]) });
    } else if (match[1] !== undefined) {
      tokens.push({ kind: 'key', value: match[1] });
    }
  }
  return tokens;
}

/**
 * Applies a surgical patch to a JSON-compatible object and returns a new
 * object (the input is not mutated). Throws when the path is invalid, when
 * an intermediate token is missing, or when traversal hits a non-object.
 */
export function applyPatch<T extends Record<string, unknown>>(
  input: T,
  patch: IntentPatch,
): T {
  if (!isValidPath(patch.path)) {
    throw new Error(`Invalid patch path: ${patch.path}`);
  }
  const tokens = tokenize(patch.path);
  if (tokens.length === 0) {
    throw new Error(`Empty patch path: ${patch.path}`);
  }

  const out = structuredClone(input);
  let cursor: unknown = out;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const tok = tokens[i];
    if (cursor === null || typeof cursor !== 'object') {
      throw new Error(
        `Path traversal hit a non-object at token "${String(tok.value)}"`,
      );
    }
    const next =
      tok.kind === 'index'
        ? (cursor as unknown[])[tok.value as number]
        : (cursor as Record<string, unknown>)[tok.value as string];
    if (next === undefined) {
      throw new Error(`Path missing intermediate at "${String(tok.value)}"`);
    }
    cursor = next;
  }
  const last = tokens[tokens.length - 1];
  if (cursor === null || typeof cursor !== 'object') {
    throw new Error('Path traversal hit a non-object before final token');
  }
  if (last.kind === 'index') {
    (cursor as unknown[])[last.value as number] = patch.value;
  } else {
    (cursor as Record<string, unknown>)[last.value as string] = patch.value;
  }
  return out;
}
