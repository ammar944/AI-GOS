// Worker capabilities payload — pure helper so the response shape can be
// unit-tested without standing up the express app. Mirrors the keys the
// Next.js /api/research-v2/_capabilities endpoint exposes so ops can diff
// frontend vs worker reality with a single grep.

import { getAnthropicSkillsRuntimeStatus } from './anthropic-skills';

export interface WorkerCapabilities {
  status: 'ok';
  anthropic: {
    authConfigured: boolean;
    skills: ReturnType<typeof getAnthropicSkillsRuntimeStatus>;
  };
  tools: {
    webSearch: boolean;
    spyfu: boolean;
    firecrawl: boolean;
    googleAds: boolean;
    metaAds: boolean;
    ga4: boolean;
    charting: boolean;
  };
  orchestrator_enabled: boolean;
  parallel_sections_enabled: boolean;
  artifact_ui_v2: boolean;
  worker_url: string;
  worker_version: string;
  orchestrate_supported: boolean;
}

export interface BuildCapabilitiesInput {
  env?: NodeJS.ProcessEnv;
  workerVersion: string;
  anthropicSkills?: ReturnType<typeof getAnthropicSkillsRuntimeStatus>;
  orchestrateSupported?: boolean;
}

export function buildCapabilitiesPayload(
  input: BuildCapabilitiesInput,
): WorkerCapabilities {
  const env = input.env ?? process.env;
  const skills = input.anthropicSkills ?? getAnthropicSkillsRuntimeStatus();

  return {
    status: 'ok',
    anthropic: {
      authConfigured: Boolean(
        env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim(),
      ),
      skills,
    },
    tools: {
      webSearch: true,
      spyfu: Boolean(env.SPYFU_API_KEY),
      firecrawl: Boolean(env.FIRECRAWL_API_KEY),
      googleAds: Boolean(
        env.GOOGLE_ADS_DEVELOPER_TOKEN &&
          env.GOOGLE_ADS_CLIENT_ID &&
          env.GOOGLE_ADS_CLIENT_SECRET &&
          env.GOOGLE_ADS_REFRESH_TOKEN &&
          env.GOOGLE_ADS_CUSTOMER_ID,
      ),
      metaAds: Boolean(
        env.META_ACCESS_TOKEN && env.META_BUSINESS_ACCOUNT_ID,
      ),
      ga4: Boolean(env.GA4_PROPERTY_ID && env.GA4_SERVICE_ACCOUNT_JSON),
      charting: true,
    },
    orchestrator_enabled: env.ENABLE_POSITIONING_ORCHESTRATOR === 'true',
    parallel_sections_enabled:
      env.NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS === 'true',
    artifact_ui_v2: env.NEXT_PUBLIC_ARTIFACT_UI_V2 === 'true',
    worker_url: env.RAILWAY_WORKER_URL ?? '',
    worker_version: input.workerVersion,
    orchestrate_supported: input.orchestrateSupported ?? false,
  };
}
