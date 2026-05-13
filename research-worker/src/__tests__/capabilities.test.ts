import { describe, expect, it } from 'vitest';
import { buildCapabilitiesPayload } from '../capabilities';

const EMPTY_SKILLS = { configured: false, skills: [] as string[] };

describe('buildCapabilitiesPayload', () => {
  it('returns the full orchestrator + artifact UI key set with defaults', () => {
    const payload = buildCapabilitiesPayload({
      env: {} as NodeJS.ProcessEnv,
      workerVersion: '1.0.0',
      anthropicSkills: EMPTY_SKILLS as never,
    });

    expect(payload.orchestrator_enabled).toBe(false);
    expect(payload.parallel_sections_enabled).toBe(false);
    expect(payload.artifact_ui_v2).toBe(false);
    expect(payload.worker_url).toBe('');
    expect(payload.worker_version).toBe('1.0.0');
    expect(payload.orchestrate_supported).toBe(false);
  });

  it('reflects all four flags when env is set to "true"', () => {
    const payload = buildCapabilitiesPayload({
      env: {
        ENABLE_POSITIONING_ORCHESTRATOR: 'true',
        NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS: 'true',
        NEXT_PUBLIC_ARTIFACT_UI_V2: 'true',
        RAILWAY_WORKER_URL: 'https://worker.example.com',
      } as unknown as NodeJS.ProcessEnv,
      workerVersion: '1.2.3',
      anthropicSkills: EMPTY_SKILLS as never,
    });

    expect(payload.orchestrator_enabled).toBe(true);
    expect(payload.parallel_sections_enabled).toBe(true);
    expect(payload.artifact_ui_v2).toBe(true);
    expect(payload.worker_url).toBe('https://worker.example.com');
    expect(payload.worker_version).toBe('1.2.3');
  });

  it('treats any non-"true" string as false', () => {
    const payload = buildCapabilitiesPayload({
      env: {
        ENABLE_POSITIONING_ORCHESTRATOR: '1',
        NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS: 'yes',
        NEXT_PUBLIC_ARTIFACT_UI_V2: 'on',
      } as unknown as NodeJS.ProcessEnv,
      workerVersion: '1.2.3',
      anthropicSkills: EMPTY_SKILLS as never,
    });

    expect(payload.orchestrator_enabled).toBe(false);
    expect(payload.parallel_sections_enabled).toBe(false);
    expect(payload.artifact_ui_v2).toBe(false);
  });

  it('honors an explicit orchestrate_supported override (flips to true in Phase 2)', () => {
    const payload = buildCapabilitiesPayload({
      env: {} as NodeJS.ProcessEnv,
      workerVersion: '1.2.3',
      anthropicSkills: EMPTY_SKILLS as never,
      orchestrateSupported: true,
    });

    expect(payload.orchestrate_supported).toBe(true);
  });

  it('exposes all expected keys for parity with /api/research-v2/_capabilities', () => {
    const payload = buildCapabilitiesPayload({
      env: {} as NodeJS.ProcessEnv,
      workerVersion: '1.0.0',
      anthropicSkills: EMPTY_SKILLS as never,
    });

    expect(payload).toHaveProperty('orchestrator_enabled');
    expect(payload).toHaveProperty('parallel_sections_enabled');
    expect(payload).toHaveProperty('artifact_ui_v2');
    expect(payload).toHaveProperty('worker_url');
    expect(payload).toHaveProperty('worker_version');
    expect(payload).toHaveProperty('orchestrate_supported');
  });
});
