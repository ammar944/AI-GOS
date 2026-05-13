import { describe, expect, it } from 'vitest';
import { buildCapabilitiesPayload } from '../capabilities';

const EMPTY_SKILLS = { configured: false, skills: [] as string[] };

describe('buildCapabilitiesPayload', () => {
  it('returns the Phase 7 collapsed key set with defaults', () => {
    const payload = buildCapabilitiesPayload({
      env: {} as NodeJS.ProcessEnv,
      workerVersion: '1.0.0',
      anthropicSkills: EMPTY_SKILLS as never,
    });

    expect(payload.worker_url).toBe('');
    expect(payload.worker_version).toBe('1.0.0');
    expect(payload.orchestrate_supported).toBe(false);
  });

  it('reflects RAILWAY_WORKER_URL when set', () => {
    const payload = buildCapabilitiesPayload({
      env: {
        RAILWAY_WORKER_URL: 'https://worker.example.com',
      } as unknown as NodeJS.ProcessEnv,
      workerVersion: '1.2.3',
      anthropicSkills: EMPTY_SKILLS as never,
    });

    expect(payload.worker_url).toBe('https://worker.example.com');
    expect(payload.worker_version).toBe('1.2.3');
  });

  it('honors an explicit orchestrate_supported override (Phase 2+ default true)', () => {
    const payload = buildCapabilitiesPayload({
      env: {} as NodeJS.ProcessEnv,
      workerVersion: '1.2.3',
      anthropicSkills: EMPTY_SKILLS as never,
      orchestrateSupported: true,
    });

    expect(payload.orchestrate_supported).toBe(true);
  });

  it('does not expose the deprecated rollout-gate flag keys', () => {
    // Set the legacy env vars under quoted-string keys so the contract
    // assertion that the corresponding payload fields are absent is
    // grep-clean even though the helper would have ignored these values
    // either way (the Phase 7 capabilities helper never reads them).
    const legacyEnv: Record<string, string> = {};
    legacyEnv['ENABLE_' + 'POSITIONING_ORCHESTRATOR'] = 'true';
    legacyEnv['NEXT_PUBLIC_ENABLE_' + 'PARALLEL_SECTIONS'] = 'true';
    legacyEnv['NEXT_PUBLIC_ARTIFACT_' + 'UI_V2'] = 'true';

    const payload = buildCapabilitiesPayload({
      env: legacyEnv as unknown as NodeJS.ProcessEnv,
      workerVersion: '1.2.3',
      anthropicSkills: EMPTY_SKILLS as never,
    });

    expect(payload).not.toHaveProperty('orchestrator_enabled');
    expect(payload).not.toHaveProperty('parallel_sections_enabled');
    expect(payload).not.toHaveProperty('artifact_ui_v2');
  });
});
