import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSkill } from '../skill-loader';

const REAL_SKILL_PATH = path.resolve(__dirname, '../../../../skills/research-competitor');

interface TempSkillOptions {
  skillContent?: string;
  includePackageJson?: boolean;
  includeOrchestrateScript?: boolean;
}

function createTempSkillFolder(options: TempSkillOptions = {}): string {
  const {
    skillContent = '---\nname: temp-skill\ndescription: temp description\n---\n# Temp Skill\n',
    includePackageJson = true,
    includeOrchestrateScript = true,
  } = options;

  const baseDir = mkdtempSync(path.join(tmpdir(), 'skill-loader-test-'));
  writeFileSync(path.join(baseDir, 'SKILL.md'), skillContent, 'utf8');

  if (includePackageJson) {
    writeFileSync(
      path.join(baseDir, 'package.json'),
      JSON.stringify({ name: 'temp-skill', private: true }, null, 2),
      'utf8',
    );
  }

  if (includeOrchestrateScript) {
    const scriptsDir = path.join(baseDir, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    writeFileSync(path.join(scriptsDir, 'orchestrate.ts'), 'process.exit(0);\n', 'utf8');
  }

  return baseDir;
}

async function expectLoadSkillError(skillFolderPath: string): Promise<void> {
  let error: unknown;

  try {
    await loadSkill(skillFolderPath);
  } catch (thrownError: unknown) {
    error = thrownError;
  }

  expect(error).toBeDefined();
  expect(error).toBeInstanceOf(Error);

  const message = (error as Error).message;
  expect(message).toContain('skill-loader:');
  expect(message).toContain(skillFolderPath);
}

describe('loadSkill', () => {
  it('loads a valid skill and returns a handle with name + description from YAML frontmatter', async () => {
    const handle = await loadSkill(REAL_SKILL_PATH);

    expect(handle.name).toBe('research-competitor');
    expect(handle.description.length).toBeGreaterThan(0);
    expect(handle.folderPath).toBe(REAL_SKILL_PATH);
    expect(typeof handle.invoke).toBe('function');
  });

  it('throws when the skill folder does not exist', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'skill-loader-missing-folder-'));
    const missingPath = path.join(tempRoot, 'does-not-exist');

    try {
      await expectLoadSkillError(missingPath);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('throws when SKILL.md is missing from the skill folder', async () => {
    const skillFolderPath = mkdtempSync(path.join(tmpdir(), 'skill-loader-missing-skill-md-'));

    try {
      writeFileSync(
        path.join(skillFolderPath, 'package.json'),
        JSON.stringify({ name: 'temp-skill', private: true }, null, 2),
        'utf8',
      );
      mkdirSync(path.join(skillFolderPath, 'scripts'), { recursive: true });
      writeFileSync(path.join(skillFolderPath, 'scripts', 'orchestrate.ts'), 'process.exit(0);\n', 'utf8');

      await expectLoadSkillError(skillFolderPath);
    } finally {
      rmSync(skillFolderPath, { recursive: true, force: true });
    }
  });

  it('throws when SKILL.md has no YAML frontmatter (no --- delimiters)', async () => {
    const skillFolderPath = createTempSkillFolder({ skillContent: '# No frontmatter\n' });

    try {
      await expectLoadSkillError(skillFolderPath);
    } finally {
      rmSync(skillFolderPath, { recursive: true, force: true });
    }
  });

  it('throws when SKILL.md YAML frontmatter is malformed', async () => {
    const skillFolderPath = createTempSkillFolder({
      skillContent: '---\nname: [broken\ndescription: hello\n---\n# Bad YAML\n',
    });

    try {
      await expectLoadSkillError(skillFolderPath);
    } finally {
      rmSync(skillFolderPath, { recursive: true, force: true });
    }
  });

  it('throws when YAML frontmatter is missing the required "name" field', async () => {
    const skillFolderPath = createTempSkillFolder({
      skillContent: '---\ndescription: hello\n---\n# Missing Name\n',
    });

    try {
      await expectLoadSkillError(skillFolderPath);
    } finally {
      rmSync(skillFolderPath, { recursive: true, force: true });
    }
  });

  it('throws when YAML frontmatter is missing the required "description" field', async () => {
    const skillFolderPath = createTempSkillFolder({
      skillContent: '---\nname: hello\n---\n# Missing Description\n',
    });

    try {
      await expectLoadSkillError(skillFolderPath);
    } finally {
      rmSync(skillFolderPath, { recursive: true, force: true });
    }
  });

  it('throws when package.json is missing', async () => {
    const skillFolderPath = createTempSkillFolder({ includePackageJson: false });

    try {
      await expectLoadSkillError(skillFolderPath);
    } finally {
      rmSync(skillFolderPath, { recursive: true, force: true });
    }
  });

  it('throws when scripts/orchestrate.ts is missing', async () => {
    const skillFolderPath = createTempSkillFolder({ includeOrchestrateScript: false });

    try {
      await expectLoadSkillError(skillFolderPath);
    } finally {
      rmSync(skillFolderPath, { recursive: true, force: true });
    }
  });
});

describe('SkillHandle.invoke', () => {
  it('spawns orchestrate.ts and returns exit code for a run_dir that does not exist (orchestrate exits non-zero, does not throw)', async () => {
    const handle = await loadSkill(REAL_SKILL_PATH);
    const runDir = path.join(mkdtempSync(path.join(tmpdir(), 'skill-loader-missing-run-dir-')), 'missing-run-dir');

    const result = await handle.invoke(runDir);

    expect(result.exitCode).not.toBe(0);
    expect(typeof result.stdout).toBe('string');
    expect(typeof result.stderr).toBe('string');
  });

  it.skip('TODO: happy-path invoke with a valid run_dir — deferred, requires full skill run setup', async () => {
    expect(true).toBe(true);
  });
});
