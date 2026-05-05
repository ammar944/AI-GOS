import { describe, expect, it } from 'vitest';
import { GTM_BRIEF_FIELD_KEYS, buildEmptyGtmBrief } from '@/lib/gtm/schemas/gtm-brief';
import {
  GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD,
  applyGtmOnboardingAnswersToBrief,
} from '@/lib/gtm/onboarding/brief-mapping';
import { getGtmOnboardingQuestions } from '@/lib/gtm/onboarding/questionnaire';

describe('GTM onboarding brief mapping', () => {
  it('maps every onboarding answer key to a concrete GTM Brief field', () => {
    const answerKeys = new Set(getGtmOnboardingQuestions().map((question) => question.answerKey));
    expect(Object.keys(GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD).sort()).toEqual([...answerKeys].sort());

    for (const fieldKey of Object.values(GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD)) {
      expect(GTM_BRIEF_FIELD_KEYS).toContain(fieldKey);
    }
  });

  it('builds an empty brief with every mapped onboarding field present', () => {
    const brief = buildEmptyGtmBrief({ updatedAt: '2026-04-24T12:00:00.000Z' });
    for (const fieldKey of Object.values(GTM_ONBOARDING_ANSWER_TO_BRIEF_FIELD)) {
      expect(brief.fields[fieldKey]).toBeDefined();
    }
  });

  it('applies onboarding answers without mutating the source brief', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01', updatedAt: '2026-04-24T12:00:00.000Z' });
    const updated = applyGtmOnboardingAnswersToBrief(
      brief,
      {
        companyName: 'AIGOS',
        channels: ['Meta', 'LinkedIn'],
        awarenessLevel: 'Problem-aware',
      },
      { updatedAt: '2026-04-24T13:00:00.000Z' },
    );

    expect(updated).not.toBe(brief);
    expect(updated.fields).not.toBe(brief.fields);
    expect(brief.fields.companyName.value).toBe('');
    expect(updated.fields.companyName.value).toBe('AIGOS');
    expect(updated.fields.channels.value).toBe('Meta, LinkedIn');
    expect(updated.fields.awarenessLevel.value).toBe('Problem-aware');
    expect(updated.fields.companyName.status).toBe('confirmed');
    expect(updated.fields.companyName.confidence).toBe('high');
    expect(updated.fields.companyName.sources[0]).toMatchObject({
      source_type: 'user_input',
      quote: 'AIGOS',
      claim_path: ['companyIdentity', 'companyName'],
    });
    expect(updated.updatedAt).toBe('2026-04-24T13:00:00.000Z');
  });
});
