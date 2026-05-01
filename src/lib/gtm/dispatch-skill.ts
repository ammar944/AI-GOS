import {
  dispatchIngestUrl,
  type IngestUrlSkillInput,
  type IngestUrlSkillResult,
} from "@/lib/gtm/skills/ingest-url";
import {
  dispatchIngestIdentity,
  type IngestIdentitySkillInput,
  type IngestIdentitySkillResult,
} from "@/lib/gtm/skills/ingest-identity";
import {
  dispatchResearchCompetitor,
  type ResearchCompetitorSkillInput,
  type ResearchCompetitorSkillResult,
} from "@/lib/gtm/skills/research-competitor";
import {
  dispatchResearchIcp,
  type ResearchIcpSkillInput,
  type ResearchIcpSkillResult,
} from "@/lib/gtm/skills/research-icp";
import {
  dispatchResearchMarket,
  type ResearchMarketSkillInput,
  type ResearchMarketSkillResult,
} from "@/lib/gtm/skills/research-market";
import { LIGHTHOUSE_DAG_ORDER } from "@/lib/gtm/lighthouse-dag";
import type { LighthouseSkill } from "@/lib/gtm/types";

export type DispatchSkillResult =
  | IngestUrlSkillResult
  | IngestIdentitySkillResult
  | ResearchMarketSkillResult
  | ResearchCompetitorSkillResult
  | ResearchIcpSkillResult;

const LIGHTHOUSE_5 = LIGHTHOUSE_DAG_ORDER;

export async function dispatchSkill(
  skill: string,
  input: unknown
): Promise<DispatchSkillResult> {
  if (skill === "ingest-url") {
    return dispatchIngestUrl(parseIngestUrlInput(input));
  }

  if (!isLighthouseSkill(skill)) {
    throw new Error(`Skill ${skill} is not implemented for lighthouse dispatch.`);
  }

  const baseInput = parseLighthouseInput(skill, input);
  const priorStages = collectPriorStageOutputs(skill, baseInput.prior_stages);

  if (skill === "ingest-identity") {
    return dispatchIngestIdentity({
      ...baseInput,
      prior_stages: priorStages,
    });
  }

  if (skill === "research-market") {
    return dispatchResearchMarket({
      ...baseInput,
      prior_stages: priorStages,
    });
  }

  if (skill === "research-competitor") {
    return dispatchResearchCompetitor({
      ...baseInput,
      prior_stages: priorStages,
    });
  }

  if (skill === "research-icp") {
    return dispatchResearchIcp({
      ...baseInput,
      prior_stages: priorStages,
    });
  }

  throw new Error(`Skill ${skill} is not implemented for lighthouse dispatch.`);
}

function parseIngestUrlInput(input: unknown): IngestUrlSkillInput {
  if (
    isRecord(input) &&
    typeof input.input_url === "string" &&
    input.input_url.trim().length > 0 &&
    typeof input.run_id === "string" &&
    input.run_id.trim().length > 0
  ) {
    return {
      input_url: input.input_url,
      run_id: input.run_id,
    };
  }

  throw new Error(
    "Invalid ingest-url dispatch input: expected non-empty input_url and run_id."
  );
}

function parseLighthouseInput(
  skill: LighthouseSkill,
  input: unknown
):
  | IngestIdentitySkillInput
  | ResearchMarketSkillInput
  | ResearchCompetitorSkillInput
  | ResearchIcpSkillInput {
  if (
    isRecord(input) &&
    typeof input.input_url === "string" &&
    input.input_url.trim().length > 0 &&
    typeof input.run_id === "string" &&
    input.run_id.trim().length > 0
  ) {
    return {
      input_url: input.input_url,
      run_id: input.run_id,
      prior_stages: isRecord(input.prior_stages) ? input.prior_stages : {},
    };
  }

  throw new Error(
    `Invalid ${skill} dispatch input: expected non-empty input_url and run_id.`
  );
}

function collectPriorStageOutputs(
  skill: LighthouseSkill,
  stages: Record<string, unknown>
): Record<string, unknown> {
  const skillIndex = LIGHTHOUSE_5.indexOf(skill);
  const priorSkills = LIGHTHOUSE_5.slice(0, skillIndex);

  return priorSkills.reduce<Record<string, unknown>>((priorOutputs, stage) => {
    const stageState = stages[stage];

    if (isRecord(stageState) && "output" in stageState) {
      return {
        ...priorOutputs,
        [stage]: stageState.output,
      };
    }

    return priorOutputs;
  }, {});
}

function isLighthouseSkill(skill: string): skill is LighthouseSkill {
  return LIGHTHOUSE_5.some((lighthouseSkill) => lighthouseSkill === skill);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
