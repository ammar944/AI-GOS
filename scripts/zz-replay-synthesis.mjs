#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { tsImport } from 'tsx/esm/api';

const REQUIRED_SECTION_IDS = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningPaidMediaPlan',
];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sectionIdFromPath(path) {
  return basename(path, '.json');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function sectionFromJson(path, json) {
  if (!isRecord(json) || !isRecord(json.body)) {
    return null;
  }

  return {
    body: json.body,
    review: isRecord(json.review) ? json.review : undefined,
    sectionId:
      typeof json.sectionId === 'string' ? json.sectionId : sectionIdFromPath(path),
    sectionTitle:
      typeof json.sectionTitle === 'string' ? json.sectionTitle : sectionIdFromPath(path),
    statusSummary:
      typeof json.statusSummary === 'string' ? json.statusSummary : '',
    verdict: typeof json.verdict === 'string' ? json.verdict : '',
    verifierSummary: isRecord(json.verifierSummary) ? json.verifierSummary : undefined,
  };
}

function subjectFromDump(jsonByPath) {
  for (const json of jsonByPath.values()) {
    if (!isRecord(json) || !isRecord(json.onboardingFields)) {
      continue;
    }

    const companyName = json.onboardingFields.companyName;

    if (isRecord(companyName) && typeof companyName.value === 'string') {
      return companyName.value;
    }

    if (typeof companyName === 'string') {
      return companyName;
    }
  }

  return 'Airtable';
}

function factByKey(ledger, factKey) {
  return ledger.facts.find((fact) => fact.factKey === factKey);
}

function factHasValues(fact, patterns) {
  if (!fact) {
    return false;
  }

  return patterns.every((pattern) =>
    fact.readings.some((reading) => pattern.test(reading.value)),
  );
}

function printJson(label, value) {
  console.log(`\n${label}`);
  console.log(JSON.stringify(value, null, 2));
}

const inputPaths = process.argv.slice(2).filter((path) => path.endsWith('.json'));

if (inputPaths.length === 0) {
  throw new Error('Usage: node scripts/zz-replay-synthesis.mjs tmp/run-98bbec81/*.json');
}

const [
  { buildFactLedger },
  { findContradictions },
  { auditPaidMediaFeasibility },
] = await Promise.all([
  tsImport('../src/lib/lab-engine/agents/synthesis/fact-ledger.ts', import.meta.url),
  tsImport(
    '../src/lib/lab-engine/agents/synthesis/contradictions.ts',
    import.meta.url,
  ),
  tsImport('../src/lib/lab-engine/agents/synthesis/feasibility.ts', import.meta.url),
]);

const jsonByPath = new Map();

for (const path of inputPaths) {
  jsonByPath.set(path, await readJson(path));
}

const sections = [...jsonByPath.entries()]
  .map(([path, json]) => sectionFromJson(path, json))
  .filter((section) => section !== null);
const subjectName = subjectFromDump(jsonByPath);
const factLedger = buildFactLedger({
  requiredSectionIds: REQUIRED_SECTION_IDS,
  sections,
  subjectName,
  subjectWebsiteUrl: `https://${subjectName.toLowerCase()}.com`,
});
const contradictions = findContradictions({
  ledger: factLedger,
  sections,
});
const paidMedia = sections.find(
  (section) => section.sectionId === 'positioningPaidMediaPlan',
);
const feasibilityAudit = auditPaidMediaFeasibility({
  factLedger,
  paidMediaBody: paidMedia?.body,
});
const disputedFacts = factLedger.facts.filter((fact) => fact.disputed);
const requiredFactKeys = new Set([
  'acv',
  'keyword-cluster:non-brand-capture-ceiling',
  'keyword-cluster:category-terms',
]);

function readingRelevantToReplay(factKey, reading) {
  if (factKey === 'acv') {
    return /\$540\b|\$5,400\b/.test(reading.value);
  }

  if (factKey === 'keyword-cluster:non-brand-capture-ceiling') {
    return /4,?322|4,?300|2,?200|2,?820/.test(reading.value);
  }

  if (factKey === 'keyword-cluster:category-terms') {
    return /134 searches|50,000-100,000/.test(reading.value);
  }

  return true;
}

function summarizeReadings(fact) {
  const seen = new Set();
  return fact.readings
    .filter((reading) => readingRelevantToReplay(fact.factKey, reading))
    .filter((reading) => {
      const key = `${reading.sectionId}:${reading.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((reading) => ({
      basis: reading.basis,
      sectionId: reading.sectionId,
      value: reading.value,
      ...(reading.keywordCluster
        ? { keywordCount: reading.keywordCluster.keywords.length }
        : {}),
    }));
}

function truncateText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function addFirstCriticalExample(examples, criticalContradictions, predicate) {
  const existingIds = new Set(examples.map((contradiction) => contradiction.id));
  const match = criticalContradictions.find(
    (contradiction) =>
      !existingIds.has(contradiction.id) && predicate(contradiction),
  );

  if (match) {
    examples.push(match);
  }
}

function selectCriticalExamples(criticalContradictions) {
  const examples = [];

  addFirstCriticalExample(
    examples,
    criticalContradictions,
    (contradiction) => contradiction.id === 'numeric:acv',
  );
  addFirstCriticalExample(
    examples,
    criticalContradictions,
    (contradiction) =>
      contradiction.id === 'numeric:keyword-cluster:non-brand-capture-ceiling',
  );
  addFirstCriticalExample(
    examples,
    criticalContradictions,
    (contradiction) => contradiction.kind === 'strategic',
  );
  addFirstCriticalExample(
    examples,
    criticalContradictions,
    (contradiction) => contradiction.kind === 'inherited-stripped-claim',
  );

  for (const contradiction of criticalContradictions) {
    if (examples.length >= 6) {
      break;
    }

    addFirstCriticalExample(
      examples,
      [contradiction],
      (candidate) => candidate.severity === 'critical',
    );
  }

  return examples;
}

const disputedFactSummary = disputedFacts
  .filter((fact) => requiredFactKeys.has(fact.factKey))
  .map((fact) => ({
  factKey: fact.factKey,
  label: fact.label,
  winner: fact.winner
    ? {
        basis: fact.winner.basis,
        sectionId: fact.winner.sectionId,
        value: fact.winner.value,
      }
    : null,
  readings: summarizeReadings(fact),
}));
const criticalContradictions = contradictions.filter(
  (contradiction) => contradiction.severity === 'critical',
);
const contradictionSummary = {
  countsByKind: contradictions.reduce((accumulator, contradiction) => {
    accumulator[contradiction.kind] = (accumulator[contradiction.kind] ?? 0) + 1;
    return accumulator;
  }, {}),
  criticalExamples: selectCriticalExamples(criticalContradictions).map(
    (contradiction) => ({
      description: truncateText(contradiction.description, 360),
      id: contradiction.id,
      kind: contradiction.kind,
      resolution: contradiction.resolution,
      sections: contradiction.sections,
    }),
  ),
};
const feasibilitySummary = {
  summary: feasibilityAudit.summary,
  verdicts: feasibilityAudit.verdicts.map((verdict) => ({
    allocation: verdict.allocation,
    audience: verdict.audience,
    ceilingMax: verdict.ceiling ? Math.round(verdict.ceiling.max) : undefined,
    math: verdict.math,
    measuredVolume: verdict.measuredVolume,
    verdict: verdict.verdict,
    volumeBasis: verdict.volumeBasis,
  })),
};

printJson('FACT_LEDGER_INVENTORY', {
  disputedFactKeys: disputedFacts.map((fact) => fact.factKey),
  factCount: factLedger.facts.length,
  keywordMetricCount: factLedger.keywordMetrics.length,
});
printJson('REQUIRED_FACT_DISPUTES', disputedFactSummary);
printJson('CONTRADICTIONS', contradictionSummary);
printJson('FEASIBILITY_AUDIT', feasibilitySummary);

const acvFact = factByKey(factLedger, 'acv');
const keywordFact = factByKey(
  factLedger,
  'keyword-cluster:non-brand-capture-ceiling',
);
const caughtAcvSlip =
  acvFact?.disputed === true &&
  factHasValues(acvFact, [/\$540\b/, /\$5,400\b/]);
const caughtKeywordDispute =
  keywordFact?.disputed === true &&
  factHasValues(keywordFact, [/4,?300|4,322/, /2,?200/, /2,?820/]);
const caughtSpendInfeasibility = feasibilityAudit.verdicts.some(
  (verdict) => verdict.verdict === 'exceeds',
);
const checks = [
  ['acv_10x_slip', caughtAcvSlip],
  ['keyword_ceiling_dispute', caughtKeywordDispute],
  ['spend_vs_volume_infeasibility', caughtSpendInfeasibility],
];

console.log('\nCHECKS');
for (const [name, passed] of checks) {
  console.log(`${name}=${passed ? 'PASS' : 'FAIL'}`);
}

if (checks.some(([, passed]) => !passed)) {
  process.exitCode = 1;
}
