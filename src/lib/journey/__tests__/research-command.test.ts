import { describe, expect, it } from 'vitest';

import { parseJourneyResearchInput } from '@/lib/journey/research-command';

describe('parseJourneyResearchInput', () => {
  it('parses a research command target as a company domain instead of a literal URL', () => {
    const command = parseJourneyResearchInput('research airtable.com');

    expect(command).toEqual({
      displayText: 'research airtable.com',
      isResearchCommand: true,
      rawInput: 'research airtable.com',
      target: 'airtable.com',
      websiteUrl: 'https://airtable.com',
    });
  });

  it('keeps direct company URLs launchable without requiring the research prefix', () => {
    const command = parseJourneyResearchInput('https://airtable.com');

    expect(command).toMatchObject({
      displayText: 'research https://airtable.com',
      isResearchCommand: false,
      target: 'https://airtable.com',
      websiteUrl: 'https://airtable.com',
    });
  });

  it('rejects an empty research command target', () => {
    const command = parseJourneyResearchInput('research   ');

    expect(command).toMatchObject({
      displayText: 'research',
      isResearchCommand: true,
      target: null,
      websiteUrl: null,
    });
  });
});
