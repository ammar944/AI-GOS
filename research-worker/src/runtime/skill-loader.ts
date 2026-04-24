import { spawn } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export interface SkillHandle {
  name: string;
  description: string;
  folderPath: string;
  invoke(runDir: string): Promise<SkillInvocationResult>;
}

export interface SkillInvocationResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface SkillFrontmatter {
  name: string;
  description: string;
}

function buildSkillLoaderError(skillFolderPath: string, message: string, cause?: unknown): Error {
  const prefixedMessage = `skill-loader: ${message} (skill: ${skillFolderPath})`;
  if (cause instanceof Error) {
    return new Error(`${prefixedMessage}. cause: ${cause.message}`);
  }
  return new Error(prefixedMessage);
}

async function ensureDirectoryExists(skillFolderPath: string): Promise<void> {
  try {
    const folderStats = await stat(skillFolderPath);
    if (!folderStats.isDirectory()) {
      throw buildSkillLoaderError(skillFolderPath, 'skill folder path is not a directory');
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('skill-loader:')) {
      throw error;
    }
    throw buildSkillLoaderError(skillFolderPath, 'skill folder does not exist', error);
  }
}

async function ensureFileExists(skillFolderPath: string, filePath: string, label: string): Promise<void> {
  try {
    await access(filePath);
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw buildSkillLoaderError(skillFolderPath, `${label} is not a file: ${filePath}`);
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('skill-loader:')) {
      throw error;
    }
    throw buildSkillLoaderError(skillFolderPath, `${label} is missing: ${filePath}`, error);
  }
}

function parseSimpleYamlFrontmatterBlock(skillFolderPath: string, yamlBlock: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const lines = yamlBlock.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      throw buildSkillLoaderError(skillFolderPath, 'SKILL.md YAML frontmatter is malformed');
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key.length === 0 || value.length === 0) {
      throw buildSkillLoaderError(skillFolderPath, 'SKILL.md YAML frontmatter is malformed');
    }

    if (
      (value.startsWith('[') && !value.endsWith(']')) ||
      (value.startsWith('{') && !value.endsWith('}'))
    ) {
      throw buildSkillLoaderError(skillFolderPath, 'SKILL.md YAML frontmatter is malformed');
    }

    const normalizedValue = value.replace(/^['"]|['"]$/g, '');
    parsed[key] = normalizedValue;
  }

  return parsed;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.values(value).every((entry: unknown) => typeof entry === 'string');
}

function isModuleNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /Cannot find module|Cannot find package/.test(error.message);
}

async function parseYamlFrontmatterBlock(skillFolderPath: string, yamlBlock: string): Promise<Record<string, string>> {
  const yamlModuleName = 'yaml';

  try {
    const yamlModule = (await import(yamlModuleName)) as {
      parse(input: string): unknown;
    };

    const parsed = yamlModule.parse(yamlBlock);
    if (!isStringRecord(parsed)) {
      throw buildSkillLoaderError(skillFolderPath, 'SKILL.md YAML frontmatter is malformed');
    }

    return parsed;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('skill-loader:')) {
      throw error;
    }

    if (!isModuleNotFoundError(error)) {
      throw buildSkillLoaderError(skillFolderPath, 'SKILL.md YAML frontmatter is malformed', error);
    }

    return parseSimpleYamlFrontmatterBlock(skillFolderPath, yamlBlock);
  }
}

async function readSkillFrontmatter(skillFolderPath: string, skillMarkdownPath: string): Promise<SkillFrontmatter> {
  let content: string;

  try {
    content = await readFile(skillMarkdownPath, 'utf8');
  } catch (error: unknown) {
    throw buildSkillLoaderError(skillFolderPath, `failed to read SKILL.md: ${skillMarkdownPath}`, error);
  }

  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    throw buildSkillLoaderError(skillFolderPath, 'SKILL.md has no YAML frontmatter');
  }

  const lines = content.split(/\r?\n/);
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex === -1) {
    throw buildSkillLoaderError(skillFolderPath, 'SKILL.md has no YAML frontmatter');
  }

  const yamlBlock = lines.slice(1, closingIndex).join('\n');
  const frontmatter = await parseYamlFrontmatterBlock(skillFolderPath, yamlBlock);

  const name = frontmatter.name;
  const description = frontmatter.description;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw buildSkillLoaderError(skillFolderPath, 'SKILL.md YAML frontmatter is missing required "name" field');
  }

  if (typeof description !== 'string' || description.trim().length === 0) {
    throw buildSkillLoaderError(skillFolderPath, 'SKILL.md YAML frontmatter is missing required "description" field');
  }

  return { name, description };
}

async function invokeSkill(skillFolderPath: string, runDir: string): Promise<SkillInvocationResult> {
  return await new Promise<SkillInvocationResult>((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'scripts/orchestrate.ts', runDir], {
      cwd: skillFolderPath,
      stdio: 'pipe',
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error: Error) => {
      reject(buildSkillLoaderError(skillFolderPath, 'failed to spawn skill orchestrator', error));
    });

    child.on('close', (code: number | null) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

export async function loadSkill(skillFolderPath: string): Promise<SkillHandle> {
  const resolvedFolderPath = path.resolve(skillFolderPath);

  await ensureDirectoryExists(resolvedFolderPath);

  const skillMarkdownPath = path.join(resolvedFolderPath, 'SKILL.md');
  const packageJsonPath = path.join(resolvedFolderPath, 'package.json');
  const orchestrateScriptPath = path.join(resolvedFolderPath, 'scripts', 'orchestrate.ts');

  await ensureFileExists(resolvedFolderPath, skillMarkdownPath, 'SKILL.md');
  const { name, description } = await readSkillFrontmatter(resolvedFolderPath, skillMarkdownPath);
  await ensureFileExists(resolvedFolderPath, packageJsonPath, 'package.json');
  await ensureFileExists(resolvedFolderPath, orchestrateScriptPath, 'scripts/orchestrate.ts');

  return {
    name,
    description,
    folderPath: resolvedFolderPath,
    invoke: async (runDir: string): Promise<SkillInvocationResult> => {
      return await invokeSkill(resolvedFolderPath, runDir);
    },
  };
}
