import { z } from 'zod';

export const SourceSchema = z
  .object({
    title: z.string().describe('Human-readable source title.'),
    url: z.string().describe('Canonical public URL for the source.'),
    whyItMatters: z
      .string()
      .optional()
      .describe('Why this source supports the Section judgment.'),
  })
  .describe('Public source used to support a positioning Section Artifact.');

export type Source = z.infer<typeof SourceSchema>;

export type ValidationResult = { ok: boolean; errors: string[] };

export const VALID_URL_PATTERN = /^https?:\/\/\S+\.\S+/;

export function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function pushMissingText(
  errors: string[],
  path: string,
  value: unknown,
): void {
  if (!hasText(value)) {
    errors.push(`${path}: required field missing.`);
  }
}

export function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return Array.from(duplicates);
}

export function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

export function validateUrl(
  errors: string[],
  path: string,
  url: string,
): void {
  if (!VALID_URL_PATTERN.test(url)) {
    errors.push(`${path}: url is not a valid URL.`);
  }
}
