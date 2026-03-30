import { describe, it, expect } from 'vitest'
import { trimResearchForScripts } from '../trim-research-context'

// Helper: build a minimal research results map with only the sections provided.
function makeResults(sections: Record<string, unknown>): Record<string, { data?: unknown }> {
  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, { data: value }]),
  )
}

describe('trimResearchForScripts', () => {
  describe('intelligence field extraction', () => {
    it('extracts positioningMoves from competitors data', () => {
      const results = makeResults({
        competitors: {
          competitors: [],
          positioningMoves: ['Move A', 'Move B', 'Move C', 'Move D'],
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.positioningMoves).toEqual(['Move A', 'Move B', 'Move C'])
    })

    it('extracts audienceRefinements from icpValidation data', () => {
      const results = makeResults({
        icpValidation: {
          persona: { role: 'CMO', company: 'SaaS', demographics: '35–45' },
          triggers: [],
          audienceRefinements: ['Refinement 1', 'Refinement 2', 'Refinement 3', 'Refinement 4'],
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.audienceRefinements).toEqual(['Refinement 1', 'Refinement 2', 'Refinement 3'])
    })

    it('extracts marketOpportunities from industryMarket data', () => {
      const results = makeResults({
        industryMarket: {
          marketOpportunities: ['Opp 1', 'Opp 2', 'Opp 3', 'Opp 4'],
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.marketOpportunities).toEqual(['Opp 1', 'Opp 2', 'Opp 3'])
    })

    it('extracts topActions from crossAnalysis readinessScorecard', () => {
      const results = makeResults({
        crossAnalysis: {
          readinessScorecard: {
            topActions: ['Action 1', 'Action 2', 'Action 3', 'Action 4', 'Action 5', 'Action 6'],
          },
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.topActions).toEqual(['Action 1', 'Action 2', 'Action 3', 'Action 4', 'Action 5'])
    })

    it('caps positioningMoves at 3 items', () => {
      const results = makeResults({
        competitors: {
          competitors: [],
          positioningMoves: ['A', 'B', 'C', 'D', 'E', 'F'],
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.positioningMoves).toHaveLength(3)
    })

    it('caps topActions at 5 items', () => {
      const results = makeResults({
        crossAnalysis: {
          readinessScorecard: {
            topActions: ['1', '2', '3', '4', '5', '6', '7', '8'],
          },
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.topActions).toHaveLength(5)
    })
  })

  describe('missing intelligence fields', () => {
    it('returns undefined for positioningMoves when competitors section is absent', () => {
      const ctx = trimResearchForScripts({})

      expect(ctx.positioningMoves).toBeUndefined()
    })

    it('returns undefined for audienceRefinements when icpValidation section is absent', () => {
      const ctx = trimResearchForScripts({})

      expect(ctx.audienceRefinements).toBeUndefined()
    })

    it('returns undefined for marketOpportunities when industryMarket section is absent', () => {
      const ctx = trimResearchForScripts({})

      expect(ctx.marketOpportunities).toBeUndefined()
    })

    it('returns undefined for topActions when crossAnalysis section is absent', () => {
      const ctx = trimResearchForScripts({})

      expect(ctx.topActions).toBeUndefined()
    })

    it('returns undefined for positioningMoves when competitors data has no positioningMoves key', () => {
      const results = makeResults({
        competitors: { competitors: [{ name: 'Acme' }] },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.positioningMoves).toBeUndefined()
    })

    it('returns undefined for topActions when readinessScorecard is missing', () => {
      const results = makeResults({
        crossAnalysis: { keyInsights: ['insight'] },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.topActions).toBeUndefined()
    })

    it('does not throw when all sections are absent', () => {
      expect(() => trimResearchForScripts({})).not.toThrow()
    })

    it('does not throw when section data is undefined', () => {
      const results: Record<string, { data?: unknown }> = {
        icpValidation: { data: undefined },
        competitors: { data: undefined },
      }

      expect(() => trimResearchForScripts(results)).not.toThrow()
    })
  })

  describe('ICP monologue extraction (targetAudienceMonologue)', () => {
    it('returns triggers array from icpValidation data', () => {
      const results = makeResults({
        icpValidation: {
          triggers: [
            { trigger: 'I need more leads' },
            { trigger: 'My ads are too expensive' },
            { trigger: 'I have no time to manage campaigns' },
          ],
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.targetAudienceMonologue).toEqual([
        'I need more leads',
        'My ads are too expensive',
        'I have no time to manage campaigns',
      ])
    })

    it('returns undefined when triggers array is empty', () => {
      const results = makeResults({
        icpValidation: { triggers: [] },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.targetAudienceMonologue).toBeUndefined()
    })

    it('returns undefined when triggers key is absent', () => {
      const results = makeResults({
        icpValidation: { persona: { role: 'CEO' } },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.targetAudienceMonologue).toBeUndefined()
    })

    it('returns undefined when icpValidation section is absent entirely', () => {
      const ctx = trimResearchForScripts({})

      expect(ctx.targetAudienceMonologue).toBeUndefined()
    })

    it('caps targetAudienceMonologue at 5 triggers', () => {
      const triggers = [
        { trigger: 'Trigger 1' },
        { trigger: 'Trigger 2' },
        { trigger: 'Trigger 3' },
        { trigger: 'Trigger 4' },
        { trigger: 'Trigger 5' },
        { trigger: 'Trigger 6' },
        { trigger: 'Trigger 7' },
      ]

      const results = makeResults({ icpValidation: { triggers } })

      const ctx = trimResearchForScripts(results)

      expect(ctx.targetAudienceMonologue).toHaveLength(5)
    })

    it('filters out trigger entries where trigger string is falsy', () => {
      const results = makeResults({
        icpValidation: {
          triggers: [
            { trigger: 'Valid trigger' },
            { trigger: '' },
            { trigger: 'Another valid trigger' },
          ],
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.targetAudienceMonologue).toEqual(['Valid trigger', 'Another valid trigger'])
    })
  })

  describe('targetAudience fallback', () => {
    it('falls back to "target audience" string when icpValidation is absent', () => {
      const ctx = trimResearchForScripts({})

      expect(ctx.targetAudience).toBe('target audience')
    })

    it('builds targetAudience from persona fields when present', () => {
      const results = makeResults({
        icpValidation: {
          persona: { role: 'Founder', company: 'SaaS startup', demographics: '30–45' },
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.targetAudience).toBe('Founder, SaaS startup, 30–45')
    })

    it('skips missing persona fields when building targetAudience', () => {
      const results = makeResults({
        icpValidation: {
          persona: { role: 'CMO', company: undefined, demographics: undefined },
        },
      })

      const ctx = trimResearchForScripts(results)

      expect(ctx.targetAudience).toBe('CMO')
    })
  })
})
