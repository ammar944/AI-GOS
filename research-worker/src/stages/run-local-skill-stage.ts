import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { LocalGtmStageConfig } from '../runtime/local-stage-registry';
import type { GtmBrief, GtmBriefField } from '../schemas/gtm/gtm-brief';
import type { GtmBriefSnapshot } from '../schemas/gtm/gtm-brief-snapshot';
import type { GtmStageKey } from '../schemas/gtm/gtm-run';
import type { AgentCompetitorFragment } from './run-research-section';

export type LocalSkillStageStatus = 'completed' | 'blocked';
export type LocalSkillValidationStatus = 'passed' | 'failed' | 'skipped';
export type LocalSkillExecutor = 'codex-cli' | 'codex-ollama' | 'claude-code' | 'agent-api';
export type LocalSkillProgressEventType =
  | 'heartbeat'
  | 'tool_call'
  | 'artifact_written'
  | 'validation_started'
  | 'validation_passed'
  | 'validation_failed';
export type LocalSkillProgressStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'blocked'
  | 'timed_out'
  | 'errored';

export interface LocalSkillProgressEvent {
  eventType: LocalSkillProgressEventType;
  message: string;
  status: LocalSkillProgressStatus;
  metadata?: Record<string, unknown>;
  durationMs?: number;
  toolName?: string;
  artifactPath?: string;
  error?: string;
}

export interface LocalSkillCommandResult {
  label: string;
  command: string;
  status: LocalSkillValidationStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface LocalSkillValidationResult {
  status: LocalSkillValidationStatus;
  commands: LocalSkillCommandResult[];
}

export interface LocalSkillOutputContext {
  stage: GtmStageKey;
  skill: string;
  outputPath: string;
  rawOutput: unknown;
  generatedAt: string;
}

export interface LocalSkillArtifacts {
  runDir: string;
  inputFile: string;
  outputFile: string;
  promptFile?: string;
  transcriptFile?: string;
  reportFile?: string;
}

export interface RunLocalSkillStageInput {
  config: LocalGtmStageConfig;
  runId: string;
  briefSnapshot: GtmBriefSnapshot;
  generatedAt: string;
  runDir: string;
  skillsRoot: string;
  priorSkillOutputs: ReadonlyMap<GtmStageKey, LocalSkillOutputContext>;
  agentFragments?: {
    competitors?: AgentCompetitorFragment;
  };
  onProgress?: (event: LocalSkillProgressEvent) => Promise<void> | void;
}

export interface RunLocalSkillStageResult {
  status: LocalSkillStageStatus;
  output?: unknown;
  rawOutput?: unknown;
  notes?: string;
  blocker?: string;
  skillRunDir: string;
  inputFile: string;
  skillOutputFile: string;
  skillCommand?: string;
  skillExitCode?: number | null;
  artifacts: LocalSkillArtifacts;
  validation: LocalSkillValidationResult;
}

interface PackageJsonShape {
  scripts: Record<string, string>;
}

interface LocalCommandInvocation {
  label: string;
  executable: string;
  args: string[];
  command: string;
  stdin?: string;
  timeoutMs?: number;
}

interface SourcePrimitive {
  source_url: string;
  retrieved_at: string;
}

interface SourcedClaim extends SourcePrimitive {
  claim: string;
}

const STANDARD_SOURCE_URL = 'https://www.airtable.com';
const OUTPUT_FILENAME = 'output.json';
const FRAGMENTS_DIRNAME = 'fragments';
const AGENT_PROMPT_FILENAME = 'agent-prompt.md';
const AGENT_FINAL_MESSAGE_FILENAME = 'agent-final.md';
const LOCAL_SKILL_EXECUTOR_ENV = 'AIGOS_LOCAL_SKILL_EXECUTOR';
const LOCAL_AGENT_API_URL_ENV = 'AIGOS_LOCAL_AGENT_API_URL';
const LOCAL_AGENT_TIMEOUT_MS_ENV = 'AIGOS_LOCAL_AGENT_TIMEOUT_MS';
const DEFAULT_LOCAL_SKILL_EXECUTOR: LocalSkillExecutor = 'codex-cli';
const DEFAULT_LOCAL_AGENT_TIMEOUT_MS = 600_000;
const LOCAL_SKILL_EXECUTORS: readonly LocalSkillExecutor[] = [
  'codex-cli',
  'codex-ollama',
  'claude-code',
  'agent-api',
];

const ICP_FIELD_KEYS = [
  'companyName',
  'companyUrl',
  'category',
  'productDescription',
  'targetCustomer',
  'primaryIcpDescription',
  'jobTitles',
  'icpRoles',
  'companySize',
  'buyingCommittee',
  'buyingTriggers',
  'icpPains',
  'currentAlternative',
  'awarenessLevel',
  'icpObjections',
  'market',
  'industryVertical',
  'geography',
  'useCases',
  'corePromise',
  'firstValueMoment',
  'activationEvent',
  'salesMotion',
  'gtmMotion',
  'topCompetitors',
  'knownCompetitors',
  'alternatives',
  'commonObjections',
  'keyPromises',
] as const;

const VOC_FIELD_KEYS = [
  'companyName',
  'companyUrl',
  'category',
  'productDescription',
  'targetCustomer',
  'primaryIcpDescription',
  'icpPains',
  'currentAlternative',
  'buyingTriggers',
  'icpObjections',
  'topCompetitors',
  'knownCompetitors',
  'alternatives',
  'jobTitles',
  'icpRoles',
  'companySize',
  'buyingCommittee',
  'awarenessLevel',
  'firstValueMoment',
  'activationEvent',
  'salesMotion',
  'gtmMotion',
  'market',
  'industryVertical',
  'geography',
  'useCases',
  'corePromise',
  'categoryFrames',
  'lossReasons',
  'competitorStrengths',
  'commonObjections',
  'keyPromises',
] as const;

const KEYWORD_FIELD_KEYS = [
  'companyName',
  'companyUrl',
  'category',
  'productDescription',
  'targetCustomer',
  'primaryIcpDescription',
  'jobTitles',
  'icpPains',
  'currentAlternative',
  'awarenessLevel',
  'goals',
  'campaignObjective',
  'targetMarket',
  'market',
  'industryVertical',
  'geography',
  'useCases',
  'corePromise',
  'cta',
  'topCompetitors',
  'knownCompetitors',
  'alternatives',
  'categoryFrames',
  'commonObjections',
  'keyPromises',
  'channels',
  'whatIsWorking',
  'whatIsNotWorking',
] as const;

const OFFER_FIELD_KEYS = [
  'companyName',
  'companyUrl',
  'category',
  'productDescription',
  'targetCustomer',
  'corePromise',
  'firstValueMoment',
  'activationEvent',
  'cta',
  'packaging',
  'pricingModel',
  'pricingTiers',
  'targetPlan',
  'useCases',
  'coreDeliverables',
  'retentionDrivers',
  'conversionPath',
  'landingPages',
  'salesMotion',
  'gtmMotion',
  'avgAcv',
  'acv',
  'salesCycleLength',
  'salesCycle',
  'testimonials',
  'caseStudies',
  'logos',
  'metrics',
  'claims',
  'commonObjections',
  'keyPromises',
  'whatIsWorking',
  'whatIsNotWorking',
] as const;

const CROSS_FIELD_KEYS = [
  'companyName',
  'companyUrl',
  'category',
  'productDescription',
  'targetCustomer',
  'goals',
  'campaignObjective',
  'expectedOutput',
  'targetMarket',
  'primaryIcpDescription',
  'jobTitles',
  'icpRoles',
  'companySize',
  'buyingCommittee',
  'buyingTriggers',
  'icpPains',
  'currentAlternative',
  'awarenessLevel',
  'icpObjections',
  'market',
  'industryVertical',
  'geography',
  'useCases',
  'corePromise',
  'firstValueMoment',
  'activationEvent',
  'salesMotion',
  'gtmMotion',
  'topCompetitors',
  'knownCompetitors',
  'alternatives',
  'commonObjections',
  'keyPromises',
] as const;

export async function runLocalSkillStage(
  input: RunLocalSkillStageInput,
): Promise<RunLocalSkillStageResult> {
  const skillFolder = join(input.skillsRoot, input.config.skill);
  const inputFile = join(input.runDir, 'input.json');
  const skillOutputFile = join(input.runDir, OUTPUT_FILENAME);
  const validation: LocalSkillValidationResult = {
    status: 'skipped',
    commands: [],
  };

  rmSync(input.runDir, { recursive: true, force: true });
  mkdirSync(input.runDir, { recursive: true });

  if (!existsSync(skillFolder)) {
    return blockedResult({
      input,
      inputFile,
      skillOutputFile,
      validation,
      blocker: `Skill folder missing: ${skillFolder}`,
    });
  }

  let packageJson: PackageJsonShape;
  try {
    packageJson = readPackageJson(skillFolder);
    const stageInput = buildSkillInput(input);
    writeFileSync(inputFile, `${JSON.stringify(stageInput, null, 2)}\n`);
    await emitProgress(input, {
      eventType: 'artifact_written',
      message: `Input artifact written for ${input.config.stage}.`,
      status: 'running',
      artifactPath: inputFile,
      metadata: {
        artifact: 'input_file',
      },
    });
  } catch (error: unknown) {
    return blockedResult({
      input,
      inputFile,
      skillOutputFile,
      validation,
      blocker: errorMessage(error),
    });
  }

  const checkCommand = packageJson.scripts.check ? npmCommand('check', []) : null;
  if (checkCommand) {
    await emitProgress(input, {
      eventType: 'validation_started',
      message: 'Starting check validation gate.',
      status: 'running',
      toolName: checkCommand.label,
      metadata: {
        command: checkCommand.command,
      },
    });
  }
  const checkResult = checkCommand ? runCommand(skillFolder, checkCommand) : null;
  if (checkResult) {
    validation.commands.push(checkResult);
    await emitProgress(input, {
      eventType: checkResult.status === 'passed' ? 'validation_passed' : 'validation_failed',
      message: `${checkResult.label} ${checkResult.status}.`,
      status: 'running',
      toolName: checkResult.label,
      metadata: {
        command: checkResult.command,
        exit_code: checkResult.exitCode,
      },
      ...(checkResult.status === 'failed' ? { error: checkResult.stderr || checkResult.stdout } : {}),
    });
    if (checkResult.status === 'failed') {
      validation.status = 'failed';
      return blockedResult({
        input,
        inputFile,
        skillOutputFile,
        validation,
        blocker: commandBlocker(checkResult),
      });
    }
  }

  await emitProgress(input, {
    eventType: 'tool_call',
    message: `Starting local agent executor for ${input.config.command}.`,
    status: 'running',
    toolName: input.config.command,
    metadata: {
      skill: input.config.skill,
      run_dir: input.runDir,
    },
  });
  const agentResult = await runLocalAgentExecutor({
    repoRoot: join(input.skillsRoot, '..'),
    skillFolder,
    skill: input.config.skill,
    skillCommand: input.config.command,
    runDir: input.runDir,
    inputFile,
  });
  validation.commands.push(agentResult);
  await emitProgress(input, {
    eventType: agentResult.status === 'passed' ? 'validation_passed' : 'validation_failed',
    message: `${agentResult.label} ${agentResult.status}.`,
    status: 'running',
    toolName: agentResult.label,
    metadata: {
      command: agentResult.command,
      exit_code: agentResult.exitCode,
    },
    ...(agentResult.status === 'failed' ? { error: agentResult.stderr || agentResult.stdout } : {}),
  });
  if (agentResult.status === 'failed') {
    validation.status = 'failed';
    return blockedResult({
      input,
      inputFile,
      skillOutputFile,
      skillCommand: agentResult.command,
      skillExitCode: agentResult.exitCode,
      validation,
      blocker: commandBlocker(agentResult),
    });
  }

  let hasAgentArtifact = false;
  try {
    hasAgentArtifact = hasAgentOutputArtifact(input.runDir, skillOutputFile);
  } catch (error: unknown) {
    validation.status = 'failed';
    return blockedResult({
      input,
      inputFile,
      skillOutputFile,
      skillCommand: agentResult.command,
      skillExitCode: agentResult.exitCode,
      validation,
      blocker: errorMessage(error),
    });
  }

  if (!hasAgentArtifact) {
    validation.status = 'failed';
    return blockedResult({
      input,
      inputFile,
      skillOutputFile,
      skillCommand: agentResult.command,
      skillExitCode: agentResult.exitCode,
      validation,
      blocker: missingAgentOutputBlocker(input, skillOutputFile, agentResult),
    });
  }

  const invokeCommand = buildInvokeCommand({
    skillFolder,
    scripts: packageJson.scripts,
    runDir: input.runDir,
    stage: input.config.stage,
  });
  if (!invokeCommand) {
    validation.status = 'skipped';
    return blockedResult({
      input,
      inputFile,
      skillOutputFile,
      validation,
      blocker: `No local invocation command found for ${input.config.skill}. Expected package script "orchestrate", script file scripts/orchestrate.ts, or synthesize-positioning package script "run".`,
    });
  }

  await emitProgress(input, {
    eventType: 'validation_started',
    message: 'Starting skill invocation.',
    status: 'running',
    toolName: invokeCommand.label,
    metadata: {
      command: invokeCommand.command,
    },
  });
  const invokeResult = runCommand(skillFolder, invokeCommand);
  validation.commands.push(invokeResult);
  await emitProgress(input, {
    eventType: invokeResult.status === 'passed' ? 'validation_passed' : 'validation_failed',
    message: `${invokeResult.label} ${invokeResult.status}.`,
    status: 'running',
    toolName: invokeResult.label,
    metadata: {
      command: invokeResult.command,
      exit_code: invokeResult.exitCode,
    },
    ...(invokeResult.status === 'failed' ? { error: invokeResult.stderr || invokeResult.stdout } : {}),
  });
  if (invokeResult.status === 'failed') {
    validation.status = 'failed';
    return blockedResult({
      input,
      inputFile,
      skillOutputFile,
      skillCommand: agentResult.command,
      skillExitCode: agentResult.exitCode,
      validation,
      blocker: commandBlocker(invokeResult),
    });
  }

  if (!existsSync(skillOutputFile)) {
    validation.status = 'failed';
    return blockedResult({
      input,
      inputFile,
      skillOutputFile,
      skillCommand: agentResult.command,
      skillExitCode: agentResult.exitCode,
      validation,
      blocker: `Skill invocation completed but did not produce ${skillOutputFile}`,
    });
  }

  for (const gate of buildOutputGateCommands({
    skillFolder,
    scripts: packageJson.scripts,
    outputPath: skillOutputFile,
  })) {
    await emitProgress(input, {
      eventType: 'validation_started',
      message: `Starting ${gate.label} validation gate.`,
      status: 'running',
      toolName: gate.label,
      metadata: {
        command: gate.command,
      },
    });
    const gateResult = runCommand(skillFolder, gate);
    validation.commands.push(gateResult);
    await emitProgress(input, {
      eventType: gateResult.status === 'passed' ? 'validation_passed' : 'validation_failed',
      message: `${gateResult.label} ${gateResult.status}.`,
      status: 'running',
      toolName: gateResult.label,
      metadata: {
        command: gateResult.command,
        exit_code: gateResult.exitCode,
      },
      ...(gateResult.status === 'failed' ? { error: gateResult.stderr || gateResult.stdout } : {}),
    });
    if (gateResult.status === 'failed') {
      validation.status = 'failed';
      return blockedResult({
        input,
        inputFile,
        skillOutputFile,
        skillCommand: agentResult.command,
        skillExitCode: agentResult.exitCode,
        validation,
        blocker: commandBlocker(gateResult),
      });
    }
  }

  const rawOutput = readJsonFile(skillOutputFile);
  const output = summarizeSkillOutput(input.config.stage, rawOutput, input.generatedAt);
  validation.status = 'passed';

  return {
    status: 'completed',
    output,
    rawOutput,
    notes: `${input.config.skill} invoked locally; output accepted from ${skillOutputFile}.`,
    skillRunDir: input.runDir,
    inputFile,
    skillOutputFile,
    skillCommand: agentResult.command,
    skillExitCode: agentResult.exitCode,
    artifacts: buildSkillArtifacts(input.runDir, inputFile, skillOutputFile),
    validation,
  };
}

function blockedResult(input: {
  input: RunLocalSkillStageInput;
  inputFile: string;
  skillOutputFile: string;
  validation: LocalSkillValidationResult;
  blocker: string;
  skillCommand?: string;
  skillExitCode?: number | null;
}): RunLocalSkillStageResult {
  return {
    status: 'blocked',
    notes: `${input.input.config.skill} could not produce a validated local output.`,
    blocker: input.blocker,
    skillRunDir: input.input.runDir,
    inputFile: input.inputFile,
    skillOutputFile: input.skillOutputFile,
    skillCommand: input.skillCommand,
    skillExitCode: input.skillExitCode,
    artifacts: buildSkillArtifacts(input.input.runDir, input.inputFile, input.skillOutputFile),
    validation: input.validation,
  };
}

async function emitProgress(
  input: RunLocalSkillStageInput,
  event: LocalSkillProgressEvent,
): Promise<void> {
  await input.onProgress?.(event);
}

function buildSkillInput(input: RunLocalSkillStageInput): unknown {
  const companyName = fieldValue(input.briefSnapshot, 'companyName') ?? 'Airtable';
  const category = fieldValue(input.briefSnapshot, 'category') ?? 'No-code database';
  const companyUrl = normalizeUrl(fieldValue(input.briefSnapshot, 'companyUrl') ?? STANDARD_SOURCE_URL);

  if (input.config.stage === 'discover-url') {
    const linkedinRaw = fieldValue(input.briefSnapshot, 'linkedinUrl' as never) ?? undefined;
    const isLinkedinCompanyUrl = (value: string | undefined): value is string => {
      if (!value) return false;
      try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        return (
          (host === 'linkedin.com' || host === 'www.linkedin.com') &&
          parsed.pathname.startsWith('/company/') &&
          parsed.pathname.split('/').filter(Boolean).length >= 2
        );
      } catch {
        return false;
      }
    };
    return {
      run_id: input.runId,
      brief_id: input.briefSnapshot.parentBriefId,
      stage: 'discover-url' as const,
      url: companyUrl,
      ...(isLinkedinCompanyUrl(linkedinRaw) ? { linkedin_url: linkedinRaw } : {}),
    };
  }

  if (input.config.stage === 'discover-identity') {
    const discoverUrlOutput = asRecord(input.priorSkillOutputs.get('discover-url')?.rawOutput);
    const canonicalUrl =
      stringField(asRecord(discoverUrlOutput?.canonical_url), 'value') ?? companyUrl;
    const discoveredPages = arrayField(discoverUrlOutput, 'discovered_pages')
      .map((entry) => {
        const record = asRecord(entry);
        const url = stringField(record, 'url');
        if (!url) return null;
        return {
          url,
          page_type: stringField(record, 'page_type') ?? 'other',
          title: stringField(asRecord(record?.title), 'value'),
          excerpt: stringField(asRecord(record?.excerpt), 'value'),
        };
      })
      .filter((entry): entry is {
        url: string;
        page_type: string;
        title: string | undefined;
        excerpt: string | undefined;
      } => Boolean(entry));

    return {
      run_id: input.runId,
      url: canonicalUrl,
      canonical_url: canonicalUrl,
      discovered_pages: discoveredPages,
    };
  }

  if (input.config.stage === 'research-market-category') {
    return {
      run_id: input.runId,
      briefSnapshot: input.briefSnapshot,
      priorOutputs: {
        ingest_identity: buildBasicIdentity(input.briefSnapshot),
      },
    };
  }

  if (input.config.stage === 'research-buyer-icp') {
    return {
      run_id: input.runId,
      brief_snapshot_id: input.briefSnapshot.snapshotId,
      stage: 'research-buyer-icp',
      gtm_brief: buildLockedBrief(input.briefSnapshot, ICP_FIELD_KEYS),
      ingest_identity: buildBasicIdentity(input.briefSnapshot, 'ingest-identity'),
      research_market: buildIcpMarketPrior(input.priorSkillOutputs.get('research-market-category')?.rawOutput),
    };
  }

  if (input.config.stage === 'research-competitors') {
    return {
      run_id: input.runId,
      company_name: companyName,
      product_description: fieldValue(input.briefSnapshot, 'productDescription') ?? 'Connected apps platform.',
      icp: fieldValue(input.briefSnapshot, 'primaryIcpDescription') ?? fieldValue(input.briefSnapshot, 'targetCustomer') ?? 'Business teams',
      industry: fieldValue(input.briefSnapshot, 'industryVertical') ?? category,
      geo: fieldValue(input.briefSnapshot, 'geography') ?? undefined,
      stated_competitors: splitListField(input.briefSnapshot, 'knownCompetitors'),
      pricing: fieldValue(input.briefSnapshot, 'pricingModel') ?? undefined,
    };
  }

  if (input.config.stage === 'research-voc') {
    return {
      run_id: input.runId,
      brief_snapshot_id: input.briefSnapshot.snapshotId,
      stage: 'research-voc',
      tier: 'smb',
      gtm_brief: buildLockedBrief(input.briefSnapshot, VOC_FIELD_KEYS),
      ingest_identity: buildBasicIdentity(input.briefSnapshot, 'ingest-identity'),
      research_market: buildVocMarketPrior(input.priorSkillOutputs.get('research-market-category')?.rawOutput),
      research_competitor: buildVocCompetitorPrior(input.priorSkillOutputs.get('research-competitors')?.rawOutput),
    };
  }

  if (input.config.stage === 'research-demand-intent') {
    return {
      run_id: input.runId,
      brief_snapshot_id: input.briefSnapshot.snapshotId,
      stage: 'research-demand-intent',
      gtm_brief: buildLockedBrief(input.briefSnapshot, KEYWORD_FIELD_KEYS),
      ingest_identity: buildBasicIdentity(input.briefSnapshot, 'ingest-identity'),
      research_market: buildKeywordMarketPrior(input.priorSkillOutputs.get('research-market-category')?.rawOutput),
      research_icp: buildKeywordIcpPrior(input.priorSkillOutputs.get('research-buyer-icp')?.rawOutput),
    };
  }

  if (input.config.stage === 'research-offer-funnel') {
    return {
      run_id: input.runId,
      brief_snapshot_id: input.briefSnapshot.snapshotId,
      locked_gtm_brief: buildOfferLockedBrief(input.briefSnapshot),
      ingest_identity: buildOfferIdentity(input.briefSnapshot, input.generatedAt),
      research_market: buildOfferMarketPrior(input.priorSkillOutputs.get('research-market-category')?.rawOutput),
    };
  }

  if (input.config.stage === 'synthesize-strategy') {
    return buildResearchCrossInput(input);
  }

  if (input.config.stage === 'generate-media-plan' || input.config.stage === 'generate-scripts') {
    const strategy = input.priorSkillOutputs.get('synthesize-strategy');
    if (!strategy) {
      throw new Error(`${input.config.stage} requires a completed synthesize-strategy output.`);
    }
    return strategy.rawOutput;
  }

  throw new Error(`No local skill input builder for stage ${input.config.stage}`);
}

function buildResearchCrossInput(input: RunLocalSkillStageInput): unknown {
  const market = input.priorSkillOutputs.get('research-market-category');
  const icp = input.priorSkillOutputs.get('research-buyer-icp');
  const offer = input.priorSkillOutputs.get('research-offer-funnel');
  const competitor = input.priorSkillOutputs.get('research-competitors');
  const voc = input.priorSkillOutputs.get('research-voc');
  const keywords = input.priorSkillOutputs.get('research-demand-intent');
  const missing = [
    ['research-market', market],
    ['research-icp', icp],
    ['research-offer', offer],
    ['research-competitor', competitor],
    ['research-voc', voc],
    ['research-keywords', keywords],
  ]
    .filter(([, context]) => !context)
    .map(([skill]) => skill);

  if (missing.length > 0) {
    throw new Error(`synthesize-strategy requires completed upstream skill outputs: ${missing.join(', ')}`);
  }

  return {
    run_id: input.runId,
    brief_snapshot_id: input.briefSnapshot.snapshotId,
    stage: 'synthesize-strategy',
    gtm_brief: buildLockedBrief(input.briefSnapshot, CROSS_FIELD_KEYS),
    ingest_identity: buildCrossIdentityPrior(input.briefSnapshot, input.generatedAt, input.runDir),
    research_market: buildCrossMarketPrior(market),
    research_icp: buildCrossIcpPrior(icp),
    research_offer: buildCrossOfferPrior(offer),
    research_competitor: buildCrossCompetitorPrior(competitor),
    research_voc: buildCrossVocPrior(voc),
    research_keywords: buildCrossKeywordsPrior(keywords),
  };
}

function buildLockedBrief(
  snapshot: GtmBriefSnapshot,
  keys: readonly string[],
): Pick<GtmBrief, 'briefId' | 'clientId' | 'fields' | 'createdAt' | 'updatedAt'> {
  return {
    briefId: snapshot.parentBriefId,
    clientId: null,
    fields: Object.fromEntries(
      keys.map((key) => [key, convertBriefFieldForStrictSkill(fieldByKey(snapshot, key))]),
    ) as GtmBrief['fields'],
    createdAt: snapshot.briefCreatedAt,
    updatedAt: snapshot.briefUpdatedAt,
  };
}

function buildOfferLockedBrief(snapshot: GtmBriefSnapshot): unknown {
  const brief = buildLockedBrief(snapshot, OFFER_FIELD_KEYS);
  return {
    ...brief,
    fields: Object.fromEntries(
      OFFER_FIELD_KEYS.map((key) => [key, convertBriefFieldForOfferSkill(fieldByKey(snapshot, key))]),
    ),
    lockedAt: snapshot.snapshotCreatedAt,
  };
}

function convertBriefFieldForStrictSkill(field: GtmBriefField | undefined): unknown {
  const safeField: GtmBriefField = field ?? {
    value: '',
    status: 'missing',
    confidence: 'missing',
    sources: [],
    updatedBy: 'system',
    updatedAt: new Date().toISOString(),
  };

  return {
    value: safeField.value,
    status: safeField.status,
    confidence: safeField.confidence,
    sources: safeField.sources.map((source) => ({
      type: source.type,
      label: source.label,
      url: source.url,
      retrievedAt: source.capturedAt,
    })),
    updatedBy: safeField.updatedBy,
    updatedAt: safeField.updatedAt,
  };
}

function convertBriefFieldForOfferSkill(field: GtmBriefField | undefined): unknown {
  const converted = convertBriefFieldForStrictSkill(field) as {
    value: string;
    status: string;
    confidence: string;
    sources: Array<{ type?: string; label?: string; url?: string; retrievedAt?: string }>;
    updatedBy: string;
    updatedAt: string;
  };
  return {
    ...converted,
    sources: converted.sources.map((source) => ({
      type: mapOfferSourceType(source.type),
      label: source.label,
      url: source.url,
      retrieved_at: source.retrievedAt,
    })),
  };
}

function mapOfferSourceType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  if (type === 'manual_note') return 'manual';
  if (type === 'web_research' || type === 'tool_result' || type === 'ad_library') return 'research';
  if (type === 'transcript') return 'document';
  return type;
}

function buildBasicIdentity(snapshot: GtmBriefSnapshot, stage?: 'ingest-identity'): Record<string, unknown> {
  const companyUrl = normalizeUrl(fieldValue(snapshot, 'companyUrl') ?? STANDARD_SOURCE_URL);
  return {
    ...(stage ? { stage } : {}),
    canonical_company_name: fieldValue(snapshot, 'companyName') ?? 'Airtable',
    canonical_domain: domainFromUrl(companyUrl),
    category: fieldValue(snapshot, 'category') ?? 'No-code database',
    core_keywords: buildKeywordStrings(snapshot),
    negative_keywords: splitListField(snapshot, 'forbiddenClaims'),
  };
}

function buildOfferIdentity(snapshot: GtmBriefSnapshot, generatedAt: string): unknown {
  const companyUrl = normalizeUrl(fieldValue(snapshot, 'companyUrl') ?? STANDARD_SOURCE_URL);
  return {
    stage: 'ingest-identity',
    company_name: fieldValue(snapshot, 'companyName') ?? 'Airtable',
    canonical_domain: domainFromUrl(companyUrl),
    category: fieldValue(snapshot, 'category') ?? 'No-code database',
    core_keywords: buildKeywordStrings(snapshot).map((value) => ({
      value,
      source_url: companyUrl,
      retrieved_at: generatedAt,
    })),
    negative_keywords: splitListField(snapshot, 'forbiddenClaims'),
    generated_at: generatedAt,
  };
}

function buildIcpMarketPrior(rawOutput: unknown): unknown {
  const output = asRecord(rawOutput);
  if (!output) return undefined;
  return {
    stage: 'research-market-category',
    category: stringField(output, 'category') ?? nestedStringField(output, ['market_scope', 'category']) ?? 'No-code database',
    category_framing: nestedStringField(output, ['category_definition', 'definition']),
    market_context: stringArrayFromClaims(arrayField(output, 'demand_drivers')),
  };
}

function buildVocMarketPrior(rawOutput: unknown): unknown {
  const output = asRecord(rawOutput);
  if (!output) return undefined;
  return {
    stage: 'research-market-category',
    category: stringField(output, 'category') ?? nestedStringField(output, ['market_scope', 'category']) ?? 'No-code database',
    category_framing: nestedStringField(output, ['category_definition', 'definition']),
    category_definition: claimFromObject(output.category_definition),
    pains: sourceClaimsFromObjects(arrayField(output, 'demand_drivers')),
    demand_drivers: sourceClaimsFromObjects(arrayField(output, 'demand_drivers')),
    adoption_barriers: sourceClaimsFromObjects(arrayField(output, 'adoption_barriers')),
  };
}

function buildKeywordMarketPrior(rawOutput: unknown): unknown {
  const output = asRecord(rawOutput);
  if (!output) return undefined;
  return {
    stage: 'research-market-category',
    category: stringField(output, 'category') ?? nestedStringField(output, ['market_scope', 'category']),
    category_framing: nestedStringField(output, ['category_definition', 'definition']),
    demand_drivers: sourceClaimsFromObjects(arrayField(output, 'demand_drivers')),
    buying_triggers: sourceClaimsFromObjects(arrayField(output, 'buying_triggers')),
    adoption_barriers: sourceClaimsFromObjects(arrayField(output, 'adoption_barriers')),
  };
}

function buildKeywordIcpPrior(rawOutput: unknown): unknown {
  const output = asRecord(rawOutput);
  if (!output) return undefined;
  return {
    stage: 'research-buyer-icp',
    persona_anchors: arrayField(output, 'persona_anchors').map((entry) => {
      const record = asRecord(entry);
      return {
        persona_name: stringField(record, 'persona_name') ?? 'Buyer',
        role_family: stringField(record, 'role_family') ?? 'Operations',
        pains: sourceClaimsFromObjects(arrayField(record, 'pains')),
        objections: sourceClaimsFromObjects(arrayField(record, 'objections')),
      };
    }),
    search_intent: arrayField(output, 'search_intent'),
    buying_committee_notes: sourceClaimsFromObjects(arrayField(output, 'buying_committee_notes')),
    exclusions: sourceClaimsFromObjects(arrayField(output, 'exclusions')),
  };
}

function buildOfferMarketPrior(rawOutput: unknown): unknown {
  const output = asRecord(rawOutput);
  if (!output) return undefined;
  return {
    stage: 'research-market-category',
    category: stringField(output, 'category') ?? nestedStringField(output, ['market_scope', 'category']) ?? 'No-code database',
    category_summary: stringField(output, 'summary'),
    demand_context: sourceClaimsFromObjects(arrayField(output, 'demand_drivers')).map((claim) => ({
      value: claim.claim,
      source_url: claim.source_url,
      retrieved_at: claim.retrieved_at,
    })),
    generated_at: stringField(output, 'generated_at') ?? new Date().toISOString(),
  };
}

function buildVocCompetitorPrior(rawOutput: unknown): unknown {
  const output = asRecord(rawOutput);
  if (!output) return undefined;
  const competitors = arrayField(output, 'competitor_set').map((entry) => {
    const record = asRecord(entry);
    return {
      name: stringField(record, 'name') ?? 'Competitor',
      type: stringField(record, 'type') ?? 'direct',
      source_url: stringField(record, 'source_url'),
      retrieved_at: stringField(record, 'retrieved_at'),
    };
  });
  return {
    stage: 'research-competitor',
    competitor_set: competitors,
  };
}

function buildCrossIdentityPrior(
  snapshot: GtmBriefSnapshot,
  generatedAt: string,
  runDir: string,
): unknown {
  const companyUrl = normalizeUrl(fieldValue(snapshot, 'companyUrl') ?? STANDARD_SOURCE_URL);
  const companyName = fieldValue(snapshot, 'companyName') ?? 'Airtable';
  return {
    skill: 'ingest-identity',
    stage: 'ingest-identity',
    output_path: join(runDir, 'identity-from-brief.json'),
    generated_at: generatedAt,
    key_claims: [
      {
        claim: `Locked GTM Brief identifies the company as ${companyName}.`,
        source_url: companyUrl,
        retrieved_at: generatedAt,
      },
    ],
    canonical_company_name: companyName,
    canonical_domain: domainFromUrl(companyUrl),
    category: fieldValue(snapshot, 'category') ?? 'No-code database',
    core_keywords: buildKeywordStrings(snapshot),
    negative_keywords: splitListField(snapshot, 'forbiddenClaims'),
  };
}

function buildCrossMarketPrior(context: LocalSkillOutputContext | undefined): unknown {
  const raw = asRecord(context?.rawOutput);
  if (!context || !raw) throw new Error('Missing research-market output.');
  return {
    skill: 'research-market',
    stage: 'research-market-category',
    output_path: context.outputPath,
    generated_at: stringField(raw, 'generated_at') ?? context.generatedAt,
    key_claims: keyClaimsFromRaw(raw, context),
    research_gaps: sourceGapsFromRaw(raw),
    category: stringField(raw, 'category') ?? nestedStringField(raw, ['market_scope', 'category']) ?? 'No-code database',
  };
}

function buildCrossIcpPrior(context: LocalSkillOutputContext | undefined): unknown {
  const raw = asRecord(context?.rawOutput);
  if (!context || !raw) throw new Error('Missing research-icp output.');
  return {
    skill: 'research-icp',
    stage: 'research-buyer-icp',
    output_path: context.outputPath,
    generated_at: stringField(raw, 'generated_at') ?? context.generatedAt,
    key_claims: keyClaimsFromRaw(raw, context),
    research_gaps: sourceGapsFromRaw(raw),
    persona_anchors: arrayField(raw, 'persona_anchors')
      .map((entry) => stringField(asRecord(entry), 'persona_name'))
      .filter((value): value is string => Boolean(value)),
  };
}

function buildCrossOfferPrior(context: LocalSkillOutputContext | undefined): unknown {
  const raw = asRecord(context?.rawOutput);
  if (!context || !raw) throw new Error('Missing research-offer output.');
  return {
    skill: 'research-offer',
    stage: 'research-offer-funnel',
    output_path: context.outputPath,
    generated_at: stringField(raw, 'generated_at') ?? context.generatedAt,
    key_claims: keyClaimsFromRaw(raw, context),
    research_gaps: sourceGapsFromRaw(raw),
    offer_claims: sourceClaimsFromObjects([
      ...arrayField(asRecord(raw.offer_path), 'promise'),
      ...arrayField(raw, 'value_props'),
    ]),
  };
}

function buildCrossCompetitorPrior(context: LocalSkillOutputContext | undefined): unknown {
  const raw = asRecord(context?.rawOutput);
  if (!context || !raw) throw new Error('Missing research-competitor output.');
  return {
    skill: 'research-competitor',
    stage: 'research-competitors',
    output_path: context.outputPath,
    generated_at: stringField(raw, 'generated_at') ?? context.generatedAt,
    key_claims: keyClaimsFromRaw(raw, context),
    research_gaps: sourceGapsFromRaw(raw),
    competitor_set: arrayField(raw, 'competitor_set')
      .map((entry) => stringField(asRecord(entry), 'name'))
      .filter((value): value is string => Boolean(value)),
  };
}

function buildCrossVocPrior(context: LocalSkillOutputContext | undefined): unknown {
  const raw = asRecord(context?.rawOutput);
  if (!context || !raw) throw new Error('Missing research-voc output.');
  return {
    skill: 'research-voc',
    stage: 'research-voc',
    output_path: context.outputPath,
    generated_at: stringField(raw, 'generated_at') ?? context.generatedAt,
    key_claims: keyClaimsFromRaw(raw, context),
    research_gaps: sourceGapsFromRaw(raw),
    objection_evidence: sourceClaimsFromObjects(arrayField(raw, 'objection_language')),
  };
}

function buildCrossKeywordsPrior(context: LocalSkillOutputContext | undefined): unknown {
  const raw = asRecord(context?.rawOutput);
  if (!context || !raw) throw new Error('Missing research-keywords output.');
  return {
    skill: 'research-keywords',
    stage: 'research-demand-intent',
    output_path: context.outputPath,
    generated_at: stringField(raw, 'generated_at') ?? context.generatedAt,
    key_claims: keyClaimsFromRaw(raw, context),
    research_gaps: sourceGapsFromRaw(raw),
    demand_intents: sourceClaimsFromObjects(
      arrayField(raw, 'intent_clusters').flatMap((entry) => arrayField(asRecord(entry), 'evidence')),
    ),
  };
}

function summarizeSkillOutput(stage: GtmStageKey, rawOutput: unknown, generatedAt: string): unknown {
  const raw = asRecord(rawOutput);
  if (!raw) {
    return {
      summary: `${stage} produced a non-object output.`,
      keyFindings: [],
      evidenceIds: [],
      assumptions: [`Invoked at ${generatedAt}.`],
    };
  }

  if (typeof raw.summary === 'string' && Array.isArray(raw.keyFindings) && Array.isArray(raw.evidenceIds)) {
    return {
      summary: raw.summary,
      keyFindings: raw.keyFindings.filter((value): value is string => typeof value === 'string'),
      evidenceIds: raw.evidenceIds.filter((value): value is string => typeof value === 'string'),
      assumptions: Array.isArray(raw.assumptions)
        ? raw.assumptions.filter((value): value is string => typeof value === 'string')
        : sourceGapsFromRaw(raw),
    };
  }

  if (stage === 'discover-url') {
    const prefilled = arrayField(raw, 'prefilled_fields');
    const fieldKeys = prefilled
      .map((entry) => stringField(asRecord(entry), 'field_key'))
      .filter((value): value is string => Boolean(value));
    const pages = arrayField(raw, 'discovered_pages');
    const pageUrls = pages
      .map((entry) => stringField(asRecord(entry), 'url'))
      .filter((value): value is string => Boolean(value));
    const companyName = stringField(asRecord(raw.company_name), 'value') ?? 'Unknown';
    const sourceGapDescriptions = arrayField(raw, 'source_gaps').map((entry) => {
      const record = asRecord(entry);
      const field = stringField(record, 'field') ?? 'unknown_field';
      const severity = stringField(record, 'severity') ?? 'info';
      const reason = stringField(record, 'reason') ?? '';
      return `[${severity}] ${field}: ${reason}`;
    });
    return baseSummary(
      `ingest-url discovered ${pages.length} page(s) for ${companyName} and prefilled ${fieldKeys.length} GTM brief field(s).`,
      fieldKeys,
      pageUrls,
      sourceGapDescriptions,
    );
  }

  if (stage === 'discover-identity') {
    const companyName = stringField(raw, 'company_name') ?? 'Unknown';
    const category = stringField(raw, 'category') ?? 'unknown category';
    const coreKeywords = arrayField(raw, 'core_keywords')
      .filter((value): value is string => typeof value === 'string')
      .slice(0, 8);
    const sourceUrls = arrayField(raw, 'sources')
      .map((entry) => stringField(asRecord(entry), 'source_url'))
      .filter((value): value is string => Boolean(value));
    const sourceGapDescriptions = arrayField(raw, 'source_gaps').map((entry) => {
      const record = asRecord(entry);
      const field = stringField(record, 'field') ?? 'unknown_field';
      const severity = stringField(record, 'severity') ?? 'info';
      const reason = stringField(record, 'reason') ?? '';
      return `[${severity}] ${field}: ${reason}`;
    });
    return baseSummary(
      `ingest-identity resolved ${companyName} as ${category} with ${coreKeywords.length} core keyword(s).`,
      coreKeywords,
      sourceUrls,
      sourceGapDescriptions,
    );
  }

  if (stage === 'research-buyer-icp') {
    const personas = arrayField(raw, 'persona_anchors')
      .map((entry) => stringField(asRecord(entry), 'persona_name'))
      .filter((value): value is string => Boolean(value));
    return baseSummary(
      `research-icp produced ${personas.length} persona anchor(s).`,
      personas,
      evidenceUrlsFromValue(raw),
      sourceGapsFromRaw(raw),
    );
  }

  if (stage === 'research-competitors') {
    const names = arrayField(raw, 'competitor_set')
      .map((entry) => {
        const record = asRecord(entry);
        const name = stringField(record, 'name');
        const type = stringField(record, 'type') ?? 'unknown';
        return name ? `${name} (${type})` : null;
      })
      .filter((value): value is string => Boolean(value));
    return baseSummary(
      `research-competitor produced ${names.length} competitor entr${names.length === 1 ? 'y' : 'ies'}.`,
      names,
      evidenceUrlsFromValue(raw),
      sourceGapsFromRaw(raw),
    );
  }

  if (stage === 'research-voc') {
    const quotes = [
      ...arrayField(raw, 'category_pain_language'),
      ...arrayField(raw, 'status_quo_frustrations'),
      ...arrayField(raw, 'objection_language'),
    ]
      .map((entry) => stringField(asRecord(entry), 'quote'))
      .filter((value): value is string => Boolean(value));
    return baseSummary(
      `research-voc produced ${quotes.length} retained VoC quote(s).`,
      quotes.slice(0, 6),
      evidenceUrlsFromValue(raw),
      sourceGapsFromRaw(raw),
    );
  }

  if (stage === 'research-demand-intent') {
    const clusters = arrayField(raw, 'intent_clusters')
      .map((entry) => stringField(asRecord(entry), 'cluster_name'))
      .filter((value): value is string => Boolean(value));
    return baseSummary(
      `research-keywords produced ${clusters.length} intent cluster(s).`,
      clusters,
      evidenceUrlsFromValue(raw),
      sourceGapsFromRaw(raw),
    );
  }

  if (stage === 'research-offer-funnel') {
    const findings = [
      ...sourceClaimsFromObjects(arrayField(asRecord(raw.offer_path), 'promise')).map((claim) => claim.claim),
      ...arrayField(raw, 'value_props').map((entry) => {
        const record = asRecord(entry);
        return [stringField(record, 'label'), stringField(record, 'value')].filter(Boolean).join(': ');
      }),
    ].filter((value): value is string => Boolean(value));
    return baseSummary(
      `research-offer produced ${findings.length} offer finding(s).`,
      findings,
      evidenceUrlsFromValue(raw),
      sourceGapsFromRaw(raw),
    );
  }

  if (stage === 'synthesize-strategy') {
    return baseSummary(
      `research-cross produced ${arrayField(raw, 'cross_findings').length} cross finding(s).`,
      arrayField(raw, 'cross_findings')
        .map((entry) => stringField(asRecord(entry), 'finding'))
        .filter((value): value is string => Boolean(value)),
      evidenceUrlsFromValue(raw),
      sourceGapsFromRaw(raw),
    );
  }

  if (stage === 'generate-media-plan') {
    return baseSummary(
      `synthesize-media-plan produced ${arrayField(raw, 'audienceCampaignMatrix').length} campaign matrix row(s).`,
      arrayField(raw, 'channelMix')
        .map((entry) => stringField(asRecord(entry), 'channel'))
        .filter((value): value is string => Boolean(value)),
      evidenceUrlsFromValue(raw),
      sourceGapsFromRaw(raw),
    );
  }

  if (stage === 'generate-scripts') {
    return baseSummary(
      `synthesize-scripts produced ${arrayField(raw, 'scripts').length} script(s).`,
      arrayField(raw, 'scripts')
        .map((entry) => stringField(asRecord(entry), 'hook'))
        .filter((value): value is string => Boolean(value)),
      evidenceUrlsFromValue(raw),
      sourceGapsFromRaw(raw),
    );
  }

  return baseSummary(`${stage} produced output.`, [], evidenceUrlsFromValue(raw), sourceGapsFromRaw(raw));
}

function baseSummary(
  summary: string,
  keyFindings: string[],
  evidenceIds: string[],
  assumptions: string[],
): unknown {
  return {
    summary,
    keyFindings,
    evidenceIds,
    assumptions: assumptions.length > 0 ? assumptions : ['No additional assumptions emitted by the skill output.'],
  };
}

export interface RunLocalAgentExecutorInput {
  repoRoot: string;
  skillFolder: string;
  skill: string;
  skillCommand: string;
  runDir: string;
  inputFile: string;
}

interface BuildAgentExecutionPlanInput extends RunLocalAgentExecutorInput {
  prompt: string;
  promptPath: string;
  finalMessagePath: string;
  timeoutMs: number;
}

interface InvokeAgentApiInput extends BuildAgentExecutionPlanInput {
  agentApiUrl: string;
}

type AgentExecutionPlan =
  | { cwd: string; command: LocalCommandInvocation }
  | { result: LocalSkillCommandResult };

async function runLocalAgentExecutor(input: RunLocalAgentExecutorInput): Promise<LocalSkillCommandResult> {
  const executorValue = localSkillExecutorValue();
  if (!isLocalSkillExecutor(executorValue)) {
    return failedCommandResult({
      label: 'agent',
      command: `${LOCAL_SKILL_EXECUTOR_ENV}=${executorValue}`,
      stderr: `invalid_local_skill_executor: ${LOCAL_SKILL_EXECUTOR_ENV} must be one of ${LOCAL_SKILL_EXECUTORS.join(', ')}.`,
    });
  }

  const prompt = buildAgentPrompt(input);
  const promptPath = join(input.runDir, AGENT_PROMPT_FILENAME);
  const finalMessagePath = join(input.runDir, AGENT_FINAL_MESSAGE_FILENAME);
  let timeoutMs: number;
  try {
    timeoutMs = localAgentTimeoutMs();
  } catch (error: unknown) {
    return failedCommandResult({
      label: 'agent',
      command: LOCAL_AGENT_TIMEOUT_MS_ENV,
      stderr: errorMessage(error),
    });
  }
  writeFileSync(promptPath, `${prompt}\n`);

  if (executorValue === 'agent-api') {
    const agentApiUrl = process.env[LOCAL_AGENT_API_URL_ENV]?.trim();
    if (!agentApiUrl) {
      return failedCommandResult({
        label: 'agent:agent-api',
        command: `agent-api ${input.skillCommand} ${input.runDir}`,
        stderr: `agent_api_not_configured: set ${LOCAL_AGENT_API_URL_ENV} before using ${LOCAL_SKILL_EXECUTOR_ENV}=agent-api.`,
      });
    }

    return invokeAgentApi({
      ...input,
      agentApiUrl,
      prompt,
      promptPath,
      finalMessagePath,
      timeoutMs,
    });
  }

  const execution = buildAgentExecutionPlan({
    ...input,
    prompt,
    promptPath,
    finalMessagePath,
    timeoutMs,
  });

  if ('result' in execution) {
    return execution.result;
  }

  return runCommand(execution.cwd, execution.command);
}

function localSkillExecutorValue(): string {
  const value = process.env[LOCAL_SKILL_EXECUTOR_ENV]?.trim();
  return value && value.length > 0 ? value : DEFAULT_LOCAL_SKILL_EXECUTOR;
}

function isLocalSkillExecutor(value: string): value is LocalSkillExecutor {
  return LOCAL_SKILL_EXECUTORS.includes(value as LocalSkillExecutor);
}

function localAgentTimeoutMs(): number {
  const raw = process.env[LOCAL_AGENT_TIMEOUT_MS_ENV]?.trim();
  if (!raw) return DEFAULT_LOCAL_AGENT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${LOCAL_AGENT_TIMEOUT_MS_ENV} must be a positive integer number of milliseconds.`);
  }
  return parsed;
}

export function buildAgentPrompt(input: RunLocalAgentExecutorInput): string {
  return [
    `Run ${input.skillCommand} for this local GTM stage run directory.`,
    '',
    `Repository root: ${input.repoRoot}`,
    `Skill folder: ${input.skillFolder}`,
    `Run directory: ${input.runDir}`,
    `Input file: ${input.inputFile}`,
    `Slash command invocation: ${input.skillCommand} ${input.runDir}`,
    '',
    'Required workflow:',
    `1. Read ${input.skillFolder}/SKILL.md.`,
    `2. Read the relevant references under ${input.skillFolder}/references.`,
    `3. Read ${input.inputFile}; treat the locked brief snapshot as immutable.`,
    `4. Use available tools, web sources, and local APIs to collect real evidence for ${input.skill}.`,
    `5. Write only ${input.runDir}/output.json or JSON fragments under ${input.runDir}/${FRAGMENTS_DIRNAME}/.`,
    ...buildSkillSpecificPromptInstructions(input),
    '',
    'Constraints:',
    '- Do not edit source files, package files, schemas, prompts, or checked-in examples.',
    '- Do not write outside the run directory unless a local tool requires a temporary cache.',
    '- Do not fabricate market data, sources, pricing, statistics, or competitors.',
    '- Every factual claim in the artifact must include source_url and retrieved_at where the schema supports it.',
    '- If credible evidence cannot be collected, leave a clear blocker in your final response and do not create fake output.',
    '- The deterministic runner will execute the TypeScript tail after you exit; focus on producing the agent-owned artifact.',
  ].join('\n');
}

function buildSkillSpecificPromptInstructions(
  input: RunLocalAgentExecutorInput,
): string[] {
  if (input.skill !== 'research-competitor') {
    return [];
  }

  return [
    '',
    'research-competitor required files:',
    `- Read ${input.skillFolder}/.claude/commands/research-competitor.md before collecting.`,
    `- Read ${input.skillFolder}/prompts/collector.md.`,
    `- Read ${input.skillFolder}/prompts/competitor-set-analyst.md.`,
    `- Read ${input.skillFolder}/prompts/competitor-subagent.md.`,
    `- Read ${input.skillFolder}/prompts/sov-subagent.md when share-of-voice collection is needed.`,
    '',
    'research-competitor acceptance contract:',
    `- Write ${input.runDir}/competitors.json before per-competitor collection.`,
    `- Write one JSON fragment per competitor under ${input.runDir}/${FRAGMENTS_DIRNAME}/.`,
    `- Do not replace fan-out with one sequential all-competitor summary.`,
    '- Include the subject company itself in the competitor set.',
    '- Leave incomplete evidence as source gaps; do not fabricate quotes, pricing, ads, or market claims.',
    '- The deterministic runner will execute scripts/orchestrate.ts after fragments are present.',
  ];
}

function buildAgentExecutionPlan(input: BuildAgentExecutionPlanInput): AgentExecutionPlan {
  const executor = localSkillExecutorValue();
  if (executor === 'codex-cli' || executor === 'codex-ollama') {
    const ollamaModel = process.env.AIGOS_OLLAMA_MODEL ?? 'deepseek-v4-flash:cloud';
    const providerArgs =
      executor === 'codex-ollama'
        ? ['--oss', '--local-provider', 'ollama', '-m', ollamaModel]
        : [];
    const args = [
      'exec',
      ...providerArgs,
      '--full-auto',
      '--sandbox',
      'workspace-write',
      '--ignore-user-config',
      '--ignore-rules',
      '--cd',
      input.repoRoot,
      '--add-dir',
      input.runDir,
      '--ephemeral',
      '--color',
      'never',
      '--output-last-message',
      input.finalMessagePath,
      '-',
    ];
    return {
      cwd: input.repoRoot,
      command: {
        label: `agent:${executor}`,
        executable: 'codex',
        args,
        command: `${formatCommand('codex', args)} < ${shellQuote(input.promptPath)}`,
        stdin: input.prompt,
        timeoutMs: input.timeoutMs,
      },
    };
  }

  if (executor === 'claude-code') {
    const args = [
      '-p',
      '--permission-mode',
      'bypassPermissions',
      '--add-dir',
      input.runDir,
      '--output-format',
      'text',
      input.prompt,
    ];
    return {
      cwd: input.repoRoot,
      command: {
        label: 'agent:claude-code',
        executable: 'claude',
        args,
        command: `${formatCommand('claude', args.slice(0, -1))} < ${shellQuote(input.promptPath)}`,
        timeoutMs: input.timeoutMs,
      },
    };
  }

  return {
    result: failedCommandResult({
      label: 'agent',
      command: `${LOCAL_SKILL_EXECUTOR_ENV}=${executor}`,
      stderr: `invalid_local_skill_executor: ${LOCAL_SKILL_EXECUTOR_ENV} must be one of ${LOCAL_SKILL_EXECUTORS.join(', ')}.`,
    }),
  };
}

async function invokeAgentApi(input: InvokeAgentApiInput): Promise<LocalSkillCommandResult> {
  const command = `agent-api POST ${input.agentApiUrl} ${input.skillCommand} ${input.runDir}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(input.agentApiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        skill: input.skill,
        command: input.skillCommand,
        runDir: input.runDir,
        inputFile: input.inputFile,
        prompt: input.prompt,
        promptPath: input.promptPath,
        finalMessagePath: input.finalMessagePath,
      }),
      signal: controller.signal,
    });
    const body = await response.text();
    const responseText = body.length > 0 ? body : `status=${response.status}`;
    if (!response.ok) {
      return {
        label: 'agent:agent-api',
        command,
        status: 'failed',
        exitCode: response.status,
        stdout: '',
        stderr: truncate(`agent_api_request_failed status=${response.status}: ${responseText}`),
      };
    }

    maybeWriteAgentApiFinalMessage(input.finalMessagePath, responseText);
    return {
      label: 'agent:agent-api',
      command,
      status: 'passed',
      exitCode: 0,
      stdout: truncate(responseText),
      stderr: '',
    };
  } catch (error: unknown) {
    return {
      label: 'agent:agent-api',
      command,
      status: 'failed',
      exitCode: null,
      stdout: '',
      stderr: truncate(`agent_api_request_failed: ${errorMessage(error)}`),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function maybeWriteAgentApiFinalMessage(finalMessagePath: string, responseText: string): void {
  if (responseText.length === 0 || existsSync(finalMessagePath)) {
    return;
  }

  const parsed = tryParseJsonObject(responseText);
  const finalMessage = typeof parsed?.finalMessage === 'string'
    ? parsed.finalMessage
    : typeof parsed?.message === 'string'
      ? parsed.message
      : responseText;
  writeFileSync(finalMessagePath, `${finalMessage}\n`);
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function failedCommandResult(input: {
  label: string;
  command: string;
  stderr: string;
}): LocalSkillCommandResult {
  return {
    label: input.label,
    command: input.command,
    status: 'failed',
    exitCode: null,
    stdout: '',
    stderr: input.stderr,
  };
}

function hasAgentOutputArtifact(runDir: string, outputPath: string): boolean {
  if (existsSync(outputPath)) {
    if (!statSync(outputPath).isFile()) {
      throw new Error(`Expected agent output path to be a file: ${outputPath}`);
    }
    return true;
  }

  const fragmentsDir = join(runDir, FRAGMENTS_DIRNAME);
  if (!existsSync(fragmentsDir)) {
    return false;
  }
  if (!statSync(fragmentsDir).isDirectory()) {
    throw new Error(`Expected fragments path to be a directory: ${fragmentsDir}`);
  }

  return readdirSync(fragmentsDir).some((entry) => entry.endsWith('.json'));
}

function buildSkillArtifacts(
  runDir: string,
  inputFile: string,
  outputFile: string,
): LocalSkillArtifacts {
  const promptFile = join(runDir, AGENT_PROMPT_FILENAME);
  const transcriptFile = join(runDir, AGENT_FINAL_MESSAGE_FILENAME);
  const reportFile = join(runDir, 'report.html');

  return {
    runDir,
    inputFile,
    outputFile,
    ...(existsSync(promptFile) ? { promptFile } : {}),
    ...(existsSync(transcriptFile) ? { transcriptFile } : {}),
    ...(existsSync(reportFile) ? { reportFile } : {}),
  };
}

function buildInvokeCommand(input: {
  skillFolder: string;
  scripts: Record<string, string>;
  runDir: string;
  stage: GtmStageKey;
}): LocalCommandInvocation | null {
  if (input.scripts.orchestrate) {
    return npmCommand('orchestrate', [input.runDir]);
  }
  if (input.stage === 'synthesize-strategy' && input.scripts.run) {
    return npmCommand('run', [input.runDir]);
  }
  if (existsSync(join(input.skillFolder, 'scripts', 'orchestrate.ts'))) {
    return {
      label: 'orchestrate',
      executable: 'npx',
      args: ['tsx', 'scripts/orchestrate.ts', input.runDir],
      command: `npx tsx scripts/orchestrate.ts ${input.runDir}`,
    };
  }
  return null;
}

function buildOutputGateCommands(input: {
  skillFolder: string;
  scripts: Record<string, string>;
  outputPath: string;
}): LocalCommandInvocation[] {
  const commands: LocalCommandInvocation[] = [];
  if (input.scripts.validate) {
    commands.push(npmCommand('validate', [input.outputPath]));
  }
  if (input.scripts['sanity-check']) {
    commands.push(npmCommand('sanity-check', [input.outputPath]));
  }
  if (input.scripts['sweep-fabricated']) {
    commands.push(npmCommand('sweep-fabricated', [input.outputPath]));
  }
  return commands;
}

function npmCommand(
  scriptName: string,
  args: string[],
): LocalCommandInvocation {
  return {
    label: scriptName,
    executable: 'npm',
    args: ['run', scriptName, ...(args.length > 0 ? ['--', ...args] : [])],
    command: `npm run ${scriptName}${args.length > 0 ? ` -- ${args.join(' ')}` : ''}`,
  };
}

function formatCommand(executable: string, args: readonly string[]): string {
  return [executable, ...args].map((part) => shellQuote(part)).join(' ');
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function runCommand(
  cwd: string,
  command: LocalCommandInvocation,
): LocalSkillCommandResult {
  const result = spawnSync(command.executable, command.args, {
    cwd,
    env: process.env,
    encoding: 'utf8',
    input: command.stdin,
    timeout: command.timeoutMs,
    killSignal: 'SIGTERM',
  });
  const exitCode = result.status ?? null;
  const stderr = result.stderr && result.stderr.length > 0
    ? result.stderr
    : result.error?.message ?? '';
  return {
    label: command.label,
    command: command.command,
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    stdout: truncate(result.stdout ?? ''),
    stderr: truncate(stderr),
  };
}

function readPackageJson(skillFolder: string): PackageJsonShape {
  const packagePath = join(skillFolder, 'package.json');
  if (!existsSync(packagePath)) {
    throw new Error(`Missing package.json: ${packagePath}`);
  }
  const raw = readJsonFile(packagePath);
  const record = asRecord(raw);
  const scripts = asRecord(record?.scripts);
  if (!scripts) {
    return { scripts: {} };
  }
  return {
    scripts: Object.fromEntries(
      Object.entries(scripts)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
  };
}

function readJsonFile(pathname: string): unknown {
  return JSON.parse(readFileSync(pathname, 'utf8')) as unknown;
}

function commandBlocker(result: LocalSkillCommandResult): string {
  const detail = result.stderr.trim() || result.stdout.trim() || 'no command output';
  return `${result.label} failed with exit ${result.exitCode}: ${detail}`;
}

function missingAgentOutputBlocker(
  input: RunLocalSkillStageInput,
  skillOutputFile: string,
  agentResult: LocalSkillCommandResult,
): string {
  const fragmentsDir = join(input.runDir, FRAGMENTS_DIRNAME);
  const exitCode = agentResult.exitCode === null ? 'unknown' : String(agentResult.exitCode);
  return [
    `Agent command completed with exit_code=${exitCode} but no usable output was produced.`,
    `run_id=${input.runId}`,
    `stage=${input.config.stage}`,
    `run_dir=${input.runDir}`,
    `missing_output_path=${skillOutputFile}`,
    `missing_fragments_path=${fragmentsDir}`,
    `Next action: fix the ${input.config.skill} agent-owned collection step to write output.json or fragments/*.json, then rerun ${input.config.stage} through the existing dispatch path.`,
  ].join(' ');
}

function fieldValue(snapshot: GtmBriefSnapshot, key: string): string | null {
  const value = fieldByKey(snapshot, key)?.value.trim();
  return value && value.length > 0 ? value : null;
}

function fieldByKey(snapshot: GtmBriefSnapshot, key: string): GtmBriefField | undefined {
  return (snapshot.fields as Record<string, GtmBriefField>)[key];
}

function splitListField(snapshot: GtmBriefSnapshot, key: string): string[] {
  const value = fieldValue(snapshot, key);
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function buildKeywordStrings(snapshot: GtmBriefSnapshot): string[] {
  const category = fieldValue(snapshot, 'category');
  const industry = fieldValue(snapshot, 'industryVertical');
  return [category, industry, 'workflow apps', 'no-code database']
    .filter((entry): entry is string => Boolean(entry))
    .filter((entry, index, entries) => entries.indexOf(entry) === index);
}

function normalizeUrl(candidate: string): string {
  const trimmed = candidate.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

function domainFromUrl(candidate: string): string {
  try {
    return new URL(normalizeUrl(candidate)).hostname.replace(/^www\./, '');
  } catch {
    return candidate.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function nestedStringField(record: Record<string, unknown> | null, path: readonly string[]): string | undefined {
  let current: unknown = record;
  for (const key of path) {
    const currentRecord = asRecord(current);
    current = currentRecord?.[key];
  }
  return typeof current === 'string' && current.length > 0 ? current : undefined;
}

function arrayField(record: Record<string, unknown> | null, key: string): unknown[] {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function claimFromObject(value: unknown): SourcedClaim | undefined {
  const record = asRecord(value);
  const source = sourceFromObject(record);
  const claim = stringField(record, 'claim') ?? stringField(record, 'definition') ?? stringField(record, 'value');
  if (!source || !claim) return undefined;
  return {
    claim,
    ...source,
  };
}

function sourceClaimsFromObjects(values: unknown[]): SourcedClaim[] {
  return values
    .map((value) => claimFromObject(value))
    .filter((value): value is SourcedClaim => Boolean(value));
}

function sourceFromObject(record: Record<string, unknown> | null): SourcePrimitive | undefined {
  const sourceUrl = stringField(record, 'source_url');
  const retrievedAt = stringField(record, 'retrieved_at');
  if (!sourceUrl || !retrievedAt) return undefined;
  return {
    source_url: sourceUrl,
    retrieved_at: retrievedAt,
  };
}

function stringArrayFromClaims(values: unknown[]): string[] {
  return sourceClaimsFromObjects(values).map((claim) => claim.claim);
}

function sourceGapsFromRaw(raw: Record<string, unknown>): string[] {
  return arrayField(raw, 'source_gaps')
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      const record = asRecord(entry);
      const topic = stringField(record, 'topic') ?? 'source_gap';
      const reason = stringField(record, 'reason') ?? stringField(record, 'gap');
      return reason ? `${topic}: ${reason}` : null;
    })
    .filter((value): value is string => Boolean(value));
}

function keyClaimsFromRaw(raw: Record<string, unknown>, context: LocalSkillOutputContext): SourcedClaim[] {
  const claims = [
    ...sourceClaimsFromObjects(arrayField(raw, 'demand_drivers')),
    ...sourceClaimsFromObjects(arrayField(raw, 'buying_triggers')),
    ...sourceClaimsFromObjects(arrayField(raw, 'adoption_barriers')),
    ...sourceClaimsFromObjects(arrayField(raw, 'proof_assets')),
    ...sourceClaimsFromObjects(arrayField(raw, 'packaging_notes')),
    ...sourceClaimsFromObjects(arrayField(raw, 'public_objections')),
    ...sourceClaimsFromObjects(arrayField(raw, 'provider_status')),
    ...arrayField(raw, 'intent_clusters').flatMap((entry) => sourceClaimsFromObjects(arrayField(asRecord(entry), 'evidence'))),
    ...sourceClaimsFromObjects(arrayField(raw, 'category_pain_language')),
    ...sourceClaimsFromObjects(arrayField(raw, 'objection_language')),
  ];
  if (claims.length > 0) return claims;

  const evidenceUrl = evidenceUrlsFromValue(raw)[0] ?? STANDARD_SOURCE_URL;
  return [
    {
      claim: stringField(raw, 'summary') ?? `${context.skill} produced validated output.`,
      source_url: evidenceUrl,
      retrieved_at: context.generatedAt,
    },
  ];
}

function evidenceUrlsFromValue(value: unknown): string[] {
  const urls = new Set<string>();
  const walk = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(walk);
      return;
    }
    const record = asRecord(entry);
    if (!record) return;
    const sourceUrl = stringField(record, 'source_url') ?? stringField(record, 'url');
    if (sourceUrl) urls.add(sourceUrl);
    Object.values(record).forEach(walk);
  };
  walk(value);
  return [...urls];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function truncate(value: string): string {
  return value.length > 4_000 ? `${value.slice(0, 4_000)}…[truncated]` : value;
}
