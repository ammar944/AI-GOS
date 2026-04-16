/**
 * Deterministic check that every evidenceId in a card draft resolves to
 * an entry in the pack. Walks the draft JSON, collects evidenceIds fields,
 * throws if any fabricated IDs are present.
 */
export function assertEvidenceIdsValid(card: unknown, validIds: readonly string[]): void {
  const validSet = new Set(validIds);
  const bad: string[] = [];
  JSON.stringify(card, (key, value) => {
    if (key === 'evidenceIds' && Array.isArray(value)) {
      for (const id of value as unknown[]) {
        if (typeof id !== 'string') {
          bad.push(String(id));
          continue;
        }
        if (!validSet.has(id)) bad.push(id);
      }
    }
    return value;
  });
  if (bad.length > 0) {
    throw new Error(`fabricated evidenceIds: ${bad.join(', ')}`);
  }
}
