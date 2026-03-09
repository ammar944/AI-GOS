import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockToFile = vi.fn(async (_stream: unknown, name: string) => ({ name }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {},
  toFile: mockToFile,
}));

function emptyAsyncIterable<T>(): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      // No existing skills.
    },
  };
}

describe('skill manager upload packaging', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { clearSkillCache } = await import('../manager');
    clearSkillCache();
  });

  it('uploads skill files under the skill directory root', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'skill-123' });
    const client = {
      beta: {
        skills: {
          list: vi.fn(() => emptyAsyncIterable()),
          create: mockCreate,
        },
      },
    } as any;

    const { getOrUploadSkill } = await import('../manager');
    await getOrUploadSkill(client, 'industry-research');

    const createPayload = mockCreate.mock.calls[0]?.[0];
    const uploadedNames = createPayload.files
      .map((file: { name: string }) => file.name)
      .sort();

    expect(uploadedNames).toEqual([
      'industry-research/SKILL.md',
      'industry-research/references/output-example.md',
    ]);
  });
});
