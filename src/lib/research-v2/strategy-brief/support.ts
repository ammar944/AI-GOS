import type { StrategyBriefBody } from './schema';

export interface ValidateStrategyBriefSupportInput {
  body: StrategyBriefBody;
  committedSectionIds: readonly string[];
  evidenceSourceUrls: readonly string[];
}

export type StrategyBriefSupportResult =
  | { ok: true }
  | { ok: false; unsupported: string[] };

export function validateStrategyBriefSupport(
  input: ValidateStrategyBriefSupportInput,
): StrategyBriefSupportResult {
  const known = new Set<string>([
    ...input.committedSectionIds,
    ...input.evidenceSourceUrls,
  ]);
  const unsupported: string[] = [];

  for (const angle of input.body.angles) {
    const missing = angle.sourceEvidence.filter((ref) => !known.has(ref));
    if (missing.length === angle.sourceEvidence.length) {
      unsupported.push(
        `angle "${angle.name}" cites no known section or evidence url (cited: ${missing.join(', ')})`,
      );
    }
  }

  return unsupported.length === 0 ? { ok: true } : { ok: false, unsupported };
}
