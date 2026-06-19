#!/usr/bin/env node
// Offline Phase 0 coverage preflight over a zz-dump-run-sections bundle.
// Reads local bundle/probe artifacts only; no network, model, DB, or browser calls.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const SECTION_IDS = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningPaidMediaPlan',
];

const PROVIDERS = new Set([
  'firecrawl',
  'searchapi',
  'spyfu',
  'perplexity',
  'worker-corpus',
  'uploaded-doc',
  'operator-input',
]);

const argv = process.argv.slice(2);
const bundleArg = flagValue('--bundle');
const unknownFlags = argv.filter((arg, index) => arg.startsWith('--') && arg !== '--bundle' && argv[index - 1] !== '--bundle');

if (!bundleArg || unknownFlags.length > 0) {
  const unknown = unknownFlags.length > 0 ? ` Unknown flag(s): ${unknownFlags.join(', ')}` : '';
  console.error(`Usage: node scripts/zz-research-coverage-map.mjs --bundle <path>${unknown}`);
  process.exit(1);
}

function flagValue(name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getPath(root, path) {
  let current = root;
  for (const part of path.split('.')) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    current = current?.[part];
  }
  return current;
}

function readCount(root, path) {
  const value = getPath(root, path);
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (isRecord(value)) return Object.keys(value).length;
  return 0;
}

function domainFromUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') return undefined;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }
}

function inferProvider(ref) {
  const haystack = [
    ref.provider,
    ref.source,
    ref.publisher,
    ref.title,
    ref.evidenceKind,
    ref.url,
    ref.sourceUrl,
    ref.domain,
  ].filter(Boolean).join(' ').toLowerCase();

  if (haystack.includes('spyfu')) return 'spyfu';
  if (haystack.includes('searchapi')) return 'searchapi';
  if (haystack.includes('perplexity')) return 'perplexity';
  if (haystack.includes('firecrawl')) return 'firecrawl';
  if (haystack.includes('uploaded-doc')) return 'uploaded-doc';
  if (haystack.includes('operator')) return 'operator-input';
  if (PROVIDERS.has(ref.provider)) return ref.provider;
  return 'worker-corpus';
}

function provenanceFromRefs(values, fallbackKind) {
  const refs = [];
  const candidates = Array.isArray(values) ? values.flat(Infinity) : [values];
  for (const value of candidates) {
    if (typeof value === 'string') {
      const domain = domainFromUrl(value);
      if (domain) refs.push({ provider: inferProvider({ url: value }), sourceUrl: value, domain, evidenceKind: fallbackKind });
      continue;
    }

    if (!isRecord(value)) continue;
    const sourceUrl = value.sourceUrl ?? value.url ?? value.detailsUrl ?? value.link;
    const domain = value.domain ?? domainFromUrl(sourceUrl);
    const evidenceKind = value.evidenceKind ?? value.kind ?? value.inputType ?? fallbackKind;
    if (!sourceUrl && !domain && !value.provider && !value.source && !value.publisher) continue;
    refs.push({
      provider: inferProvider({ ...value, sourceUrl, domain, evidenceKind }),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(domain ? { domain } : {}),
      evidenceKind,
    });
  }

  return dedupeRefs(refs);
}

function collectUrls(value, acc = []) {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, acc);
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (/url$/i.test(key) && typeof item === 'string') acc.push(item);
      else collectUrls(item, acc);
    }
  }
  return acc;
}

function collectRecords(value, predicate, acc = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRecords(item, predicate, acc);
  } else if (isRecord(value)) {
    if (predicate(value)) acc.push(value);
    for (const item of Object.values(value)) collectRecords(item, predicate, acc);
  }
  return acc;
}

function dedupeRefs(refs) {
  const seen = new Set();
  const result = [];
  for (const ref of refs) {
    const key = [ref.provider, ref.sourceUrl ?? '', ref.domain ?? '', ref.evidenceKind].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result.slice(0, 20);
}

function countSourcedRows(rows) {
  return asArray(rows).filter((row) => {
    if (!isRecord(row)) return false;
    const status = String(row.status ?? row.basis ?? row.provenance ?? '').toLowerCase();
    return status.includes('sourced') || Boolean(row.sourceUrl) || asArray(row.sourceUrls).length > 0;
  }).length;
}

function countNumericKeywordRows(rows) {
  return asArray(rows).filter((row) => {
    if (!isRecord(row)) return false;
    return ['volume', 'monthlyVolume', 'searchVolume', 'cpc', 'difficulty'].some((key) => Number.isFinite(Number(row[key])));
  }).length;
}

function makeRequirement({ key, found, required, refs, gapAllowed = false, blocker }) {
  const status = found >= required ? 'satisfied' : gapAllowed ? 'gap-allowed' : 'blocked';
  return [
    key,
    {
      found,
      required,
      status,
      provenanceRefs: refs ?? [],
      ...(status === 'blocked' ? { blocker: blocker ?? `${key} found ${found}; required ${required}` } : {}),
    },
  ];
}

function makeFloor({ key, found, required, gapAllowed = false }) {
  const status = found >= required ? 'satisfied' : gapAllowed ? 'gap-allowed' : 'blocked';
  return [key, { found, required, gapAllowed, status }];
}

function sourceCoverage(section, body, subjectDomain, probeGapCount) {
  const refs = [
    ...provenanceFromRefs(asArray(section?.sources), 'section-source'),
    ...provenanceFromRefs(collectUrls(body), 'body-source'),
  ];
  const domains = new Set(refs.map((ref) => ref.domain).filter(Boolean));
  const subjectDomainRows = refs.filter((ref) => ref.domain === subjectDomain || ref.domain?.endsWith(`.${subjectDomain}`)).length;
  return {
    topLevelSources: asArray(section?.sources).length,
    independentDomains: [...domains].filter((domain) => domain !== subjectDomain && !domain.endsWith(`.${subjectDomain}`)).length,
    subjectDomainRows,
    toolGapCount: countBlockGaps(body) + probeGapCount,
  };
}

function countBlockGaps(value) {
  return collectRecords(value, (record) => isRecord(record.blockGap) || String(record.status ?? '').toLowerCase().includes('gap')).length;
}

function acquisitionFromReport(report) {
  const sufficiency = report?.sufficiency;
  if (isRecord(sufficiency)) {
    return {
      candidatesFound: Number(sufficiency.candidatesFound ?? 0),
      promoted: Number(sufficiency.promoted ?? 0),
      rejected: Number(sufficiency.rejected ?? 0),
      sufficiencyTier: normalizeTier(sufficiency.tier),
    };
  }

  const ledger = asArray(report?.acquisitionLedger);
  if (ledger.length === 0) return undefined;
  const promoted = ledger.filter((row) => row?.promotionStatus === 'promoted').length;
  const rejected = ledger.filter((row) => row?.promotionStatus === 'rejected').length;
  return {
    candidatesFound: ledger.length,
    promoted,
    rejected,
    sufficiencyTier: promoted >= 3 ? 'sufficient' : promoted > 0 ? 'partial' : 'insufficient',
  };
}

function normalizeTier(value) {
  return ['sufficient', 'partial', 'insufficient'].includes(value) ? value : 'insufficient';
}

function sectionResult(sectionId, requiredEntries, floorEntries, coverage, acquisition) {
  const requiredClasses = Object.fromEntries(requiredEntries);
  const schemaFloors = Object.fromEntries(floorEntries);
  const blockers = [
    ...Object.entries(requiredClasses).filter(([, value]) => value.status === 'blocked').map(([key, value]) => `${key}: ${value.blocker}`),
    ...Object.entries(schemaFloors).filter(([, value]) => value.status === 'blocked').map(([key, value]) => `${key}: found ${value.found}; required ${value.required}`),
  ];

  return {
    sectionId,
    canGenerate: blockers.length === 0,
    requiredClasses,
    schemaFloors,
    sourceCoverage: coverage,
    ...(acquisition ? { acquisition } : {}),
    ...(blockers.length > 0 ? { blockers } : {}),
  };
}

function buildMarketCategory(section, subjectDomain, probeGapCount) {
  const body = section.body ?? {};
  const marketSignals = asArray(body.marketSize?.signals);
  const tamInputs = asArray(body.marketSize?.bottomUpTam?.inputs);
  const sourcedTamInputs = countSourcedRows(tamInputs);
  const categoryRefs = provenanceFromRefs([body.categoryDefinition?.adjacentCategories, body.keyFindings], 'category');
  const tamRefs = provenanceFromRefs([tamInputs], 'market-size');

  return sectionResult(
    'positioningMarketCategory',
    [
      makeRequirement({ key: 'category_definition', found: body.categoryDefinition?.prose ? 1 : 0, required: 1, refs: categoryRefs }),
      makeRequirement({ key: 'adjacent_categories', found: readCount(body, 'categoryDefinition.adjacentCategories'), required: 2, refs: categoryRefs }),
      makeRequirement({ key: 'market_size_signals', found: marketSignals.length, required: 2, refs: provenanceFromRefs(marketSignals, 'market-size'), blocker: 'marketSize.signals is empty' }),
      makeRequirement({ key: 'bottom_up_tam_inputs', found: sourcedTamInputs, required: 4, refs: tamRefs }),
      makeRequirement({ key: 'caveats', found: readCount(body, 'marketSize.bottomUpTam.caveats'), required: 1, refs: tamRefs, gapAllowed: true }),
      makeRequirement({ key: 'structural_forces', found: readCount(body, 'structuralForces.forces'), required: 2, refs: provenanceFromRefs(body.structuralForces?.forces, 'structural-force'), gapAllowed: true }),
      makeRequirement({ key: 'maturity_signals', found: readCount(body, 'categoryMaturity.classification.supportingSignals'), required: 3, refs: provenanceFromRefs(body.categoryMaturity?.classification?.supportingSignals, 'maturity-signal') }),
    ],
    [
      makeFloor({ key: 'marketSize.signals', found: marketSignals.length, required: 2 }),
      makeFloor({ key: 'marketSize.bottomUpTam.inputs', found: tamInputs.length, required: 4 }),
      makeFloor({ key: 'categoryDefinition.adjacentCategories', found: readCount(body, 'categoryDefinition.adjacentCategories'), required: 2 }),
    ],
    sourceCoverage(section, body, subjectDomain, probeGapCount),
  );
}

function buildBuyerIcp(section, probes, subjectDomain, probeGapCount) {
  const body = section.body ?? {};
  const report = body.evidenceGapReport ?? {};
  const personas = asArray(body.personaReality?.personas);
  const caseStudyResults = asArray(probes['casestudy-plainfetch-ramp.json']?.results);
  const fetchedNamedAttributions = caseStudyResults.filter((row) => asArray(row.namedAttributions).length > 0).length;
  const refs = provenanceFromRefs([personas, report.acquisitionLedger, caseStudyResults.map((row) => row.url)], 'buyer-persona');

  return sectionResult(
    'positioningBuyerICP',
    [
      makeRequirement({ key: 'grounded_buyer_personas', found: Number(report.foundNamedPersonaCount ?? personas.length), required: Number(report.requiredNamedPersonaCount ?? 3), refs, blocker: report.summary }),
      makeRequirement({ key: 'firmographic_cuts', found: readCount(body, 'icpExistenceCheck.firmographicCuts'), required: 3, refs: provenanceFromRefs(body.icpExistenceCheck?.firmographicCuts, 'firmographic-cut') }),
      makeRequirement({ key: 'awareness_levels', found: readCount(body, 'awarenessDistribution.levels'), required: 3, refs: provenanceFromRefs(body.awarenessDistribution?.levels, 'awareness-level') }),
      makeRequirement({ key: 'buying_triggers', found: readCount(body, 'buyingContext.triggers'), required: 2, refs: provenanceFromRefs(body.buyingContext?.triggers, 'trigger'), gapAllowed: false }),
      makeRequirement({ key: 'venues', found: readCount(body, 'clusters.venues'), required: 2, refs: provenanceFromRefs(body.clusters?.venues, 'venue'), gapAllowed: false }),
      makeRequirement({ key: 'quote_or_gap', found: fetchedNamedAttributions, required: 3, refs, gapAllowed: false, blocker: 'case-study probe found named attributions, but bundle promoted zero buyer personas' }),
    ],
    [
      makeFloor({ key: 'personaReality.personas', found: personas.length, required: 3 }),
      makeFloor({ key: 'buyingContext.triggers', found: readCount(body, 'buyingContext.triggers'), required: 2 }),
      makeFloor({ key: 'clusters.venues', found: readCount(body, 'clusters.venues'), required: 2 }),
    ],
    sourceCoverage(section, body, subjectDomain, probeGapCount),
    acquisitionFromReport(report),
  );
}

function buildCompetitorLandscape(section, probes, subjectDomain, probeGapCount) {
  const body = section.body ?? {};
  const groups = asArray(body.adEvidence?.advertiserGroups);
  const creatives = groups.flatMap((group) => asArray(group.creatives));
  const linkedInProbeCreatives = Object.values(probes)
    .filter((probe) => isRecord(probe?.sourcesUsed))
    .flatMap((probe) => asArray(probe.adCreatives));
  const adRefs = provenanceFromRefs([creatives, linkedInProbeCreatives], 'ad');
  const pricingRows = asArray(body.pricingReality?.dataPoints);
  const competitors = asArray(body.competitorSet?.competitors);

  return sectionResult(
    'positioningCompetitorLandscape',
    [
      makeRequirement({ key: 'competitor_identities', found: competitors.length, required: 5, refs: provenanceFromRefs(competitors, 'competitor') }),
      makeRequirement({ key: 'positioning_axes', found: readCount(body, 'positioningTaxonomy.axes'), required: 2, refs: provenanceFromRefs(body.positioningTaxonomy?.axes, 'positioning-axis') }),
      makeRequirement({ key: 'pricing_rows', found: pricingRows.length, required: 3, refs: provenanceFromRefs(pricingRows, 'pricing'), blocker: body.pricingReality?.blockGap?.summary }),
      makeRequirement({ key: 'share_of_voice_slices', found: readCount(body, 'shareOfVoice.slices'), required: 2, refs: provenanceFromRefs(body.shareOfVoice?.slices, 'share-of-voice'), blocker: body.shareOfVoice?.blockGap?.summary }),
      makeRequirement({ key: 'weaknesses', found: readCount(body, 'publicWeaknesses.items'), required: 3, refs: provenanceFromRefs(body.publicWeaknesses?.items, 'weakness') }),
      makeRequirement({ key: 'narrative_arcs', found: readCount(body, 'narrativeArcs.arcs'), required: 2, refs: provenanceFromRefs(body.narrativeArcs?.arcs, 'narrative') }),
      makeRequirement({ key: 'ad_evidence_or_real_ad_gap', found: adRefs.length, required: 2, refs: adRefs }),
    ],
    [
      makeFloor({ key: 'competitorSet.competitors', found: competitors.length, required: 5 }),
      makeFloor({ key: 'pricingReality.dataPoints', found: pricingRows.length, required: 3 }),
      makeFloor({ key: 'shareOfVoice.slices', found: readCount(body, 'shareOfVoice.slices'), required: 2 }),
    ],
    sourceCoverage(section, body, subjectDomain, probeGapCount),
    linkedInProbeCreatives.length > 0 ? {
      candidatesFound: linkedInProbeCreatives.length,
      promoted: creatives.filter((creative) => creative.verified !== false).length,
      rejected: creatives.filter((creative) => creative.verified === false).length,
      sufficiencyTier: creatives.length >= 3 ? 'sufficient' : 'partial',
    } : undefined,
  );
}

function buildVoiceOfCustomer(section, probes, subjectDomain, probeGapCount) {
  const body = section.body ?? {};
  const report = body.evidenceGapReport ?? {};
  const quotes = asArray(body.painLanguage?.quotes);
  const permalinkTargets = probes['voc-permalinks-ramp.json']?.targets ?? {};
  const permalinkHits = Object.values(permalinkTargets).reduce((sum, target) => {
    if (!isRecord(target)) return sum;
    return sum + Object.values(target.anchorHits ?? {}).reduce((inner, hit) => inner + Number(hit?.links ?? 0), 0);
  }, 0);
  const refs = provenanceFromRefs([quotes, report.acquisitionLedger, collectUrls(permalinkTargets)], 'review');

  return sectionResult(
    'positioningVoiceOfCustomer',
    [
      makeRequirement({ key: 'verbatim_quotes', found: quotes.length, required: Number(report.requiredPainQuoteCount ?? 6), refs }),
      makeRequirement({ key: 'permalinked_review_quotes', found: Number(report.sufficiency?.promoted ?? 0), required: 3, refs, blocker: report.summary }),
      makeRequirement({ key: 'pain_domains', found: Number(report.foundDistinctPainSourceCount ?? asArray(report.observedPainSourceDomains).length), required: Number(report.requiredDistinctPainSourceCount ?? 3), refs }),
      makeRequirement({ key: 'objections', found: readCount(body, 'objections.items'), required: 3, refs: provenanceFromRefs(body.objections?.items, 'objection') }),
      makeRequirement({ key: 'switching_stories', found: readCount(body, 'switchingStories.stories'), required: 2, refs: provenanceFromRefs(body.switchingStories?.stories, 'switching-story'), blocker: body.switchingStories?.blockGap?.summary }),
      makeRequirement({ key: 'decision_criteria', found: readCount(body, 'decisionCriteria.criteria'), required: 2, refs: provenanceFromRefs(body.decisionCriteria?.criteria, 'decision-criteria'), blocker: body.decisionCriteria?.blockGap?.summary }),
      makeRequirement({ key: 'success_language', found: readCount(body, 'successLanguage.quotes'), required: 2, refs: provenanceFromRefs(body.successLanguage?.quotes, 'success-language'), blocker: body.successLanguage?.blockGap?.summary }),
      makeRequirement({ key: 'retrieval_summary', found: body.retrievalSummary ? 1 : 0, required: 1, refs }),
    ],
    [
      makeFloor({ key: 'painLanguage.quotes', found: quotes.length, required: 6 }),
      makeFloor({ key: 'strictPermalinkPromotions', found: Number(report.sufficiency?.promoted ?? 0), required: 3 }),
      makeFloor({ key: 'permalinkProbe.anchorLinks', found: permalinkHits, required: 3, gapAllowed: true }),
      makeFloor({ key: 'switchingStories.stories', found: readCount(body, 'switchingStories.stories'), required: 2 }),
    ],
    sourceCoverage(section, body, subjectDomain, probeGapCount),
    acquisitionFromReport(report),
  );
}

function buildDemandIntent(section, subjectDomain, probeGapCount) {
  const body = section.body ?? {};
  const keywords = asArray(body.keywordDemand?.keywords);
  const numericKeywords = countNumericKeywordRows(keywords);
  const keywordRefs = provenanceFromRefs(keywords, 'keyword');

  return sectionResult(
    'positioningDemandIntent',
    [
      makeRequirement({ key: 'keyword_rows_with_numeric_volume_cpc_difficulty', found: numericKeywords, required: 5, refs: keywordRefs }),
      makeRequirement({ key: 'questions', found: readCount(body, 'questionMining.questions'), required: 3, refs: provenanceFromRefs(body.questionMining?.questions, 'question'), blocker: body.questionMining?.blockGap?.summary }),
      makeRequirement({ key: 'content_gaps', found: readCount(body, 'contentGaps.gaps'), required: 3, refs: provenanceFromRefs(body.contentGaps?.gaps, 'content-gap') }),
      makeRequirement({ key: 'independent_intent_signals', found: readCount(body, 'intentSignals.items'), required: 3, refs: provenanceFromRefs(body.intentSignals?.items, 'intent-signal'), blocker: body.intentSignals?.blockGap?.summary }),
      makeRequirement({ key: 'venues', found: readCount(body, 'venueMap.venues'), required: 3, refs: provenanceFromRefs(body.venueMap?.venues, 'venue'), blocker: body.venueMap?.blockGap?.summary }),
    ],
    [
      makeFloor({ key: 'keywordDemand.keywords', found: keywords.length, required: 5 }),
      makeFloor({ key: 'keywordDemand.numericRows', found: numericKeywords, required: 5 }),
      makeFloor({ key: 'questionMining.questions', found: readCount(body, 'questionMining.questions'), required: 3 }),
      makeFloor({ key: 'venueMap.venues', found: readCount(body, 'venueMap.venues'), required: 3 }),
    ],
    sourceCoverage(section, body, subjectDomain, probeGapCount),
  );
}

function buildOfferDiagnostic(section, subjectDomain, probeGapCount) {
  const body = section.body ?? {};

  return sectionResult(
    'positioningOfferDiagnostic',
    [
      makeRequirement({ key: 'proof_points', found: readCount(body, 'offerMarketFit.proofPoints'), required: 2, refs: provenanceFromRefs(body.offerMarketFit?.proofPoints, 'proof-point'), blocker: body.offerMarketFit?.blockGap?.summary }),
      makeRequirement({ key: 'funnel_breaks', found: readCount(body, 'funnelDiagnosis.breaks'), required: 1, refs: provenanceFromRefs(body.funnelDiagnosis?.breaks, 'funnel-break') }),
      makeRequirement({ key: 'channel_evidence', found: readCount(body, 'channelTruth.channels'), required: 3, refs: provenanceFromRefs(body.channelTruth?.channels, 'channel-evidence') }),
      makeRequirement({ key: 'retention_signals', found: readCount(body, 'retentionHealth.signals'), required: 2, refs: provenanceFromRefs(body.retentionHealth?.signals, 'retention-signal'), blocker: body.retentionHealth?.blockGap?.summary }),
      makeRequirement({ key: 'red_flags', found: readCount(body, 'redFlags.items'), required: 1, refs: provenanceFromRefs(body.redFlags?.items, 'red-flag') }),
      makeRequirement({ key: 'binding_constraint', found: body.singleBindingConstraint?.constraint ? 1 : 0, required: 1, refs: provenanceFromRefs(body.singleBindingConstraint, 'binding-constraint') }),
    ],
    [
      makeFloor({ key: 'offerMarketFit.proofPoints', found: readCount(body, 'offerMarketFit.proofPoints'), required: 2 }),
      makeFloor({ key: 'retentionHealth.signals', found: readCount(body, 'retentionHealth.signals'), required: 2 }),
      makeFloor({ key: 'redFlags.items', found: readCount(body, 'redFlags.items'), required: 1 }),
    ],
    sourceCoverage(section, body, subjectDomain, probeGapCount),
  );
}

function buildPaidMediaPlan(section, sections, manifest, subjectDomain, probeGapCount) {
  const body = section.body ?? {};
  const evidencePackRows = collectRecords(body, (record) => isRecord(record.evidencePack));
  const evidencePackRefs = evidencePackRows.flatMap((row) => asArray(row.evidencePack?.refs));
  const evidencePackGaps = evidencePackRows.filter((row) => row.evidencePack?.status === 'gap' || asArray(row.evidencePack?.refs).length === 0).length;
  const upstreamReady = SECTION_IDS
    .filter((id) => id !== 'positioningPaidMediaPlan')
    .filter((id) => sections[id]?.review?.tier !== 'needs_review' && sections[id]?.verdict !== 'needs_review')
    .length;
  const operatorFields = ['monthlyAdBudget', 'targetCac', 'currentCac', 'visitorToSignup', 'signupToActivation', 'activationToPaid', 'creativeCapacity', 'salesProcessDocs']
    .filter((field) => manifest.briefInput?.[field] !== undefined && manifest.briefInput?.[field] !== '');
  const operatorRefs = operatorFields.map((field) => ({ provider: 'operator-input', evidenceKind: field }));

  return sectionResult(
    'positioningPaidMediaPlan',
    [
      makeRequirement({ key: 'upstream_section_facts_ready', found: upstreamReady, required: 6, refs: provenanceFromRefs(SECTION_IDS.filter((id) => id !== 'positioningPaidMediaPlan').map((id) => sections[id]?.sources ?? []), 'upstream-section'), blocker: 'Upstream sections are not all out of needs_review/insufficient state' }),
      makeRequirement({ key: 'operator_economics', found: operatorFields.length, required: 6, refs: operatorRefs }),
      makeRequirement({ key: 'budget_cac_trials_cvr_chain', found: ['monthlyAdBudget', 'targetCac', 'visitorToSignup', 'signupToActivation', 'activationToPaid'].filter((field) => operatorFields.includes(field)).length, required: 5, refs: operatorRefs }),
      makeRequirement({ key: 'creative_capacity', found: operatorFields.includes('creativeCapacity') ? 1 : 0, required: 1, refs: operatorRefs }),
      makeRequirement({ key: 'sales_assets', found: asArray(manifest.briefInput?.salesProcessDocs).length, required: 1, refs: operatorRefs, blocker: 'briefInput.salesProcessDocs is empty' }),
      makeRequirement({ key: 'evidence_pack_refs', found: evidencePackRefs.length, required: evidencePackRows.length, refs: provenanceFromRefs(evidencePackRefs, 'paid-media-evidence'), blocker: `${evidencePackGaps} paid-media evidence packs are empty or marked gap` }),
    ],
    [
      makeFloor({ key: 'anglesToTest', found: readCount(body, 'anglesToTest'), required: 4 }),
      makeFloor({ key: 'audienceTypes', found: readCount(body, 'audienceTypes'), required: 3 }),
      makeFloor({ key: 'evidencePack.refs', found: evidencePackRefs.length, required: evidencePackRows.length }),
      makeFloor({ key: 'salesProcess', found: readCount(body, 'salesProcess'), required: 1 }),
    ],
    sourceCoverage(section, body, subjectDomain, probeGapCount + evidencePackGaps),
  );
}

async function parseJsonFile(path) {
  const raw = await readFile(path, 'utf8');
  try {
    return { value: JSON.parse(raw), warning: null };
  } catch (error) {
    for (let index = 0; index < raw.length; index += 1) {
      if (raw[index] !== '{' && raw[index] !== '[') continue;
      try {
        return { value: JSON.parse(raw.slice(index)), warning: `Ignored non-JSON prefix in ${path}` };
      } catch {
        // Try the next JSON-looking character; some probe logs contain bracketed banners.
      }
    }
    return { value: null, warning: `Could not parse JSON file ${path}: ${error.message}` };
  }
}

async function loadBundle(bundleDir) {
  const sections = {};
  const missing = [];
  const malformed = [];

  const manifestRead = await parseJsonFile(join(bundleDir, '_manifest.json')).catch((error) => ({
    value: null,
    warning: `Missing required manifest: ${error.message}`,
  }));
  if (!manifestRead.value) {
    throw new Error(`Required bundle manifest is missing or malformed at ${join(bundleDir, '_manifest.json')}`);
  }

  for (const sectionId of SECTION_IDS) {
    const path = join(bundleDir, `${sectionId}.json`);
    const read = await parseJsonFile(path).catch((error) => ({ value: null, warning: error.message }));
    if (!read.value) {
      missing.push(`${sectionId}.json`);
      continue;
    }
    if (read.warning) malformed.push(read.warning);
    sections[sectionId] = read.value;
  }

  return { manifest: manifestRead.value, sections, missing, malformed };
}

async function loadProbes() {
  const probeDir = 'tmp/probe';
  const probes = {};
  const warnings = [];
  let files = [];
  try {
    files = await readdir(probeDir);
  } catch {
    return { probes, warnings: [`Optional probe directory not found: ${probeDir}`], probeGapCount: 0 };
  }

  const probeFiles = files
    .filter((name) => name.endsWith('.json') && !/^research-coverage-.*\.json$/.test(name))
    .sort();

  for (const file of probeFiles) {
    const path = join(probeDir, file);
    const read = await parseJsonFile(path);
    if (read.warning) warnings.push(read.warning);
    if (read.value) probes[file] = read.value;
    else warnings.push(`Optional probe skipped: ${path}`);
  }

  const probeGapCount = Object.values(probes).reduce((sum, probe) => sum + countProbeGaps(probe), 0);
  return { probes, warnings, probeGapCount };
}

function countProbeGaps(probe) {
  return collectRecords(probe, (record) => {
    const status = String(record.status ?? record.scrapeStatus ?? record.parserStatus ?? '').toLowerCase();
    return status.includes('failed') || Boolean(record.gapReason) || Number(record.failedAttempts ?? 0) > 0;
  }).length;
}

async function main() {
  const suffix = basename(bundleArg).replace(/[^a-zA-Z0-9_-]/g, '');
  const outputPath = join('tmp/probe', `research-coverage-${suffix}.json`);
  const { manifest, sections, missing, malformed } = await loadBundle(bundleArg);
  const { probes, warnings: probeWarnings, probeGapCount } = await loadProbes();
  const subjectDomain = domainFromUrl(manifest.subjectUrl);

  const metadata = {
    bundle: bundleArg,
    bundleSlug: suffix,
    runId: manifest.run_id ?? null,
    subjectUrl: manifest.subjectUrl ?? null,
    generatedAt: new Date().toISOString(),
    offlineOnly: true,
    missingBundleFiles: missing,
    warnings: [...malformed, ...probeWarnings],
    probesRead: Object.keys(probes).sort(),
  };

  const coverage = {
    positioningMarketCategory: sections.positioningMarketCategory
      ? buildMarketCategory(sections.positioningMarketCategory, subjectDomain, probeGapCount)
      : missingSection('positioningMarketCategory', subjectDomain),
    positioningBuyerICP: sections.positioningBuyerICP
      ? buildBuyerIcp(sections.positioningBuyerICP, probes, subjectDomain, probeGapCount)
      : missingSection('positioningBuyerICP', subjectDomain),
    positioningCompetitorLandscape: sections.positioningCompetitorLandscape
      ? buildCompetitorLandscape(sections.positioningCompetitorLandscape, probes, subjectDomain, probeGapCount)
      : missingSection('positioningCompetitorLandscape', subjectDomain),
    positioningVoiceOfCustomer: sections.positioningVoiceOfCustomer
      ? buildVoiceOfCustomer(sections.positioningVoiceOfCustomer, probes, subjectDomain, probeGapCount)
      : missingSection('positioningVoiceOfCustomer', subjectDomain),
    positioningDemandIntent: sections.positioningDemandIntent
      ? buildDemandIntent(sections.positioningDemandIntent, subjectDomain, probeGapCount)
      : missingSection('positioningDemandIntent', subjectDomain),
    positioningOfferDiagnostic: sections.positioningOfferDiagnostic
      ? buildOfferDiagnostic(sections.positioningOfferDiagnostic, subjectDomain, probeGapCount)
      : missingSection('positioningOfferDiagnostic', subjectDomain),
    positioningPaidMediaPlan: sections.positioningPaidMediaPlan
      ? buildPaidMediaPlan(sections.positioningPaidMediaPlan, sections, manifest, subjectDomain, probeGapCount)
      : missingSection('positioningPaidMediaPlan', subjectDomain),
  };

  const result = { metadata, sections: coverage };
  await mkdir('tmp/probe', { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log(`research coverage map written: ${outputPath}`);
  for (const sectionId of SECTION_IDS) {
    const section = coverage[sectionId];
    const blocked = section.blockers?.length ? ` (${section.blockers.length} blocker${section.blockers.length === 1 ? '' : 's'})` : '';
    console.log(`${sectionId}: canGenerate=${section.canGenerate}${blocked}`);
  }
}

function missingSection(sectionId, subjectDomain) {
  return sectionResult(
    sectionId,
    [
      makeRequirement({
        key: 'bundle_section_file',
        found: 0,
        required: 1,
        refs: [],
        blocker: `${sectionId}.json is missing from the bundle`,
      }),
    ],
    [makeFloor({ key: 'bundle_section_file', found: 0, required: 1 })],
    {
      topLevelSources: 0,
      independentDomains: 0,
      subjectDomainRows: subjectDomain ? 0 : 0,
      toolGapCount: 0,
    },
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
