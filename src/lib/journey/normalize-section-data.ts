import { JOURNEY_SECTION_DATA_SCHEMAS, type JourneySectionDataMap } from './schemas';

const JOURNEY_DATA_BLOCK_REGEX = /```journey-data\s*([\s\S]*?)```/i;

export function extractJourneyDataCandidate(content: string): unknown {
  const match = content.match(JOURNEY_DATA_BLOCK_REGEX);
  if (!match) return undefined;

  try {
    const parsed = JSON.parse(match[1]?.trim() ?? '');
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return (parsed as { data?: unknown }).data;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

export function stripJourneyDataBlock(content: string): string {
  return content.replace(JOURNEY_DATA_BLOCK_REGEX, '').trim();
}

export function normalizeSectionData<K extends keyof JourneySectionDataMap>(
  sectionId: K,
  candidate: unknown,
): JourneySectionDataMap[K] | undefined {
  const result = JOURNEY_SECTION_DATA_SCHEMAS[sectionId].safeParse(candidate);
  return result.success ? (result.data as JourneySectionDataMap[K]) : undefined;
}
