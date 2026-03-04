import { SECTION_LABELS } from './utils';

export interface SectionSummary {
  key: string;
  label: string;
  status: 'complete' | 'partial' | 'empty';
  fieldCount: number;
  sourceCount: number;
  tokenEstimate: number;
}

export interface BlueprintIndex {
  sections: SectionSummary[];
  totalSections: number;
  completedSections: number;
  partialSections: number;
  emptySections: number;
  lastUpdated: string;
}

/**
 * Recursively count all non-null, non-empty leaf values in an object.
 */
function countLeafFields(obj: unknown): number {
  if (obj === null || obj === undefined) return 0;
  if (typeof obj === 'string') return obj.trim().length > 0 ? 1 : 0;
  if (typeof obj === 'number' || typeof obj === 'boolean') return 1;
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + countLeafFields(item), 0);
  }
  if (typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).reduce(
      (sum, val) => sum + countLeafFields(val),
      0
    );
  }
  return 0;
}

/**
 * Build a compact index of all blueprint sections.
 * Output is ~500 tokens -- safe to embed directly in system prompt.
 */
export function buildBlueprintIndex(blueprint: Record<string, unknown>): BlueprintIndex {
  const knownSections = Object.keys(SECTION_LABELS);
  const sections: SectionSummary[] = [];

  for (const key of knownSections) {
    const sectionData = blueprint[key];
    const label = SECTION_LABELS[key] || key;

    if (!sectionData || typeof sectionData !== 'object') {
      sections.push({
        key,
        label,
        status: 'empty',
        fieldCount: 0,
        sourceCount: 0,
        tokenEstimate: 0,
      });
      continue;
    }

    const fieldCount = countLeafFields(sectionData);
    const sourceCount = Object.keys(sectionData as Record<string, unknown>).length;
    const tokenEstimate = Math.ceil(JSON.stringify(sectionData).length / 4);

    let status: 'complete' | 'partial' | 'empty';
    if (fieldCount === 0) {
      status = 'empty';
    } else if (fieldCount < 10) {
      status = 'partial';
    } else {
      status = 'complete';
    }

    sections.push({ key, label, status, fieldCount, sourceCount, tokenEstimate });
  }

  const completedSections = sections.filter(s => s.status === 'complete').length;
  const partialSections = sections.filter(s => s.status === 'partial').length;
  const emptySections = sections.filter(s => s.status === 'empty').length;

  return {
    sections,
    totalSections: sections.length,
    completedSections,
    partialSections,
    emptySections,
    lastUpdated: new Date().toISOString(),
  };
}
