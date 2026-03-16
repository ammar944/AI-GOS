export function readJourneyPrefillFieldValue(
  partialResult: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const field = partialResult?.[key];
  if (!field || typeof field !== 'object' || !('value' in field)) {
    return null;
  }

  const value = (field as { value?: string | null }).value;
  return typeof value === 'string' ? value : null;
}
