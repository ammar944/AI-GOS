import {
  buildFactLedger,
  type FactLedger,
  type FactLedgerReading,
  type SynthesisSectionInput,
} from "./synthesis/fact-ledger";

export interface CrossSectionFactReading {
  sectionId: string;
  value: string;
  context: string;
}

export interface CrossSectionFactConflict {
  factKey: string;
  readings: CrossSectionFactReading[];
}

interface SectionBodyInput {
  sectionId: string;
  body: Record<string, unknown>;
}

const maxConflicts = 8;

function toConflictReading(
  reading: FactLedgerReading,
): CrossSectionFactReading {
  return {
    context: reading.context,
    sectionId: reading.sectionId,
    value: reading.value,
  };
}

export function extractCrossSectionFactConflictsFromLedger(
  ledger: FactLedger,
): CrossSectionFactConflict[] {
  return ledger.facts
    .filter((fact) => fact.disputed)
    .map((fact) => ({
      factKey: fact.factKey,
      readings: fact.readings.map(toConflictReading),
    }))
    .sort((left, right) => right.readings.length - left.readings.length)
    .slice(0, maxConflicts);
}

export function extractCrossSectionFactConflicts({
  sections,
  subjectName,
}: {
  sections: readonly SectionBodyInput[];
  subjectName: string;
}): CrossSectionFactConflict[] {
  const ledgerSections: SynthesisSectionInput[] = sections.map((section) => ({
    body: section.body,
    sectionId: section.sectionId,
  }));
  const ledger = buildFactLedger({
    sections: ledgerSections,
    subjectName,
  });

  return extractCrossSectionFactConflictsFromLedger(ledger);
}
