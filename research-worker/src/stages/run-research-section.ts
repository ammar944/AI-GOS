// GTM stage dispatcher: run-research-section.
// Slice 1 Lane C — wires research-competitors to the research-competitor skill.
// Other research sections (market, icp, voc, demand-intent, offer-funnel) stay
// fixture-backed until their skills are implemented in later slices.

import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadSkill } from '../runtime/skill-loader';
import type { GtmBriefSnapshot } from '../schemas/gtm/gtm-brief-snapshot';

export type ResearchSectionKey =
  | 'research-market-category'
  | 'research-buyer-icp'
  | 'research-competitors'
  | 'research-voc'
  | 'research-demand-intent'
  | 'research-offer-funnel';

export interface RunResearchSectionInput {
  section: ResearchSectionKey;
  briefSnapshot: GtmBriefSnapshot;
  skillsRoot?: string;
  cleanupRunDir?: boolean;
}

export interface RunResearchSectionResult {
  section: ResearchSectionKey;
  skillInvoked: boolean;
  skillExitCode?: number;
  skillRunDir?: string;
  notes: string;
}

export async function runStage(input: RunResearchSectionInput): Promise<RunResearchSectionResult> {
  if (input.section !== 'research-competitors') {
    return {
      section: input.section,
      skillInvoked: false,
      notes: `${input.section} skill not implemented yet; fixture-backed in slice 1.`,
    };
  }

  const skillsRoot = input.skillsRoot ?? resolve(__dirname, '../../../skills');
  const skillFolder = join(skillsRoot, 'research-competitor');

  if (!existsSync(skillFolder)) {
    throw new Error(`run-research-section: skill folder missing: ${skillFolder}`);
  }

  const handle = await loadSkill(skillFolder);
  const runDir = mkdtempSync(join(tmpdir(), 'gtm-competitors-'));

  // Seed a minimal agent-stand-in: research-competitor's orchestrate.ts expects
  // <runDir>/output.json with the initial competitor_set. Slice 1 seeds a stub
  // so the deterministic tail has something to operate on. Lane D replaces this
  // with a real agent-collection phase.
  const seedOutput = {
    run_id: input.briefSnapshot.parentBriefId,
    source_company_name: input.briefSnapshot.fields.companyName?.value ?? 'Example',
    competitor_set: [],
    generated_at: new Date().toISOString(),
    tool_calls_used: 0,
  };
  writeFileSync(join(runDir, 'output.json'), JSON.stringify(seedOutput, null, 2));

  // ALLOW_SUSPECT=1 bypasses research-competitor's sanity-check which would
  // otherwise fail on empty competitor_set. The skill still runs its validate
  // gate; if that fails, we propagate the exit code and let the caller fall
  // back to fixture or surface the error.
  const invocation = await handle.invoke(runDir);

  if (input.cleanupRunDir !== false) {
    rmSync(runDir, { recursive: true, force: true });
  }

  return {
    section: input.section,
    skillInvoked: true,
    skillExitCode: invocation.exitCode,
    skillRunDir: runDir,
    notes: invocation.exitCode === 0
      ? 'research-competitor skill invoked; output not merged into stage result (Lane D work).'
      : `research-competitor exited ${invocation.exitCode}; falling back to fixture. stderr: ${invocation.stderr.slice(0, 200)}`,
  };
}
