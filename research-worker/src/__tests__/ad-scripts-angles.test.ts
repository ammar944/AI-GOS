import { describe, it, expect } from 'vitest'
import { buildPass1Prompt } from '../prompts/ad-scripts-pass1'

// Minimal valid opts — only required fields, everything optional left out.
function baseOpts(overrides: Partial<Parameters<typeof buildPass1Prompt>[0]> = {}) {
  return {
    companyName: 'Acme',
    awarenessLevel: 'problem-aware',
    count: 3,
    trimmedResearchContext: 'Research context here.',
    styleReferences: null,
    targetAudience: 'SaaS founders',
    ...overrides,
  }
}

describe('buildPass1Prompt', () => {
  describe('angle deduplication (usedAnglesAndHooks)', () => {
    it('injects "ANGLES AND HOOKS ALREADY USED" section when usedAnglesAndHooks is non-empty', () => {
      const { system } = buildPass1Prompt(
        baseOpts({
          usedAnglesAndHooks: [
            { angle: 'painPoint', hook: 'Still losing leads to broken forms?' },
            { angle: 'outcome', hook: 'What if every ad paid for itself in 30 days?' },
          ],
        }),
      )

      expect(system).toContain('ANGLES AND HOOKS ALREADY USED')
    })

    it('includes the specific angle labels and hook text in the section', () => {
      const { system } = buildPass1Prompt(
        baseOpts({
          usedAnglesAndHooks: [
            { angle: 'curiosity', hook: 'Why do 80% of B2B ads fail in the first 3 seconds?' },
          ],
        }),
      )

      expect(system).toContain('[curiosity]')
      expect(system).toContain('Why do 80% of B2B ads fail in the first 3 seconds?')
    })

    it('omits the angle section entirely when usedAnglesAndHooks is an empty array', () => {
      const { system } = buildPass1Prompt(
        baseOpts({ usedAnglesAndHooks: [] }),
      )

      expect(system).not.toContain('ANGLES AND HOOKS ALREADY USED')
    })

    it('omits the angle section entirely when usedAnglesAndHooks is undefined', () => {
      const { system } = buildPass1Prompt(
        baseOpts({ usedAnglesAndHooks: undefined }),
      )

      expect(system).not.toContain('ANGLES AND HOOKS ALREADY USED')
    })

    it('includes the minimum-diversity instruction when angles are provided', () => {
      const { system } = buildPass1Prompt(
        baseOpts({
          usedAnglesAndHooks: [{ angle: 'identity', hook: 'Founders who ship fast do this.' }],
        }),
      )

      expect(system).toContain('Minimum 2 of the 3 scripts')
    })
  })

  describe('proof points section', () => {
    it('injects AVAILABLE PROOF block with entries when proofPoints is non-empty', () => {
      const { system } = buildPass1Prompt(
        baseOpts({
          proofPoints: [
            {
              type: 'case_study',
              headline: '3x ROAS in 60 days',
              detail: 'Scaled from $10k to $30k/month',
              clientName: 'RetailBrand',
              verified: true,
            },
          ],
        }),
      )

      expect(system).toContain('AVAILABLE PROOF FOR THIS LEVEL (use these')
      expect(system).toContain('[case_study]')
      expect(system).toContain('3x ROAS in 60 days')
      expect(system).toContain('RetailBrand')
    })

    it('includes clientName in the proof line when provided', () => {
      const { system } = buildPass1Prompt(
        baseOpts({
          proofPoints: [
            {
              type: 'testimonial',
              headline: 'Cut CAC by 40%',
              detail: 'Switched from broad to laser targeting',
              clientName: 'FinTechCo',
              verified: true,
            },
          ],
        }),
      )

      expect(system).toContain('FinTechCo')
    })

    it('omits clientName separator when clientName is absent', () => {
      const { system } = buildPass1Prompt(
        baseOpts({
          proofPoints: [
            {
              type: 'data_point',
              headline: '92% open rate',
              detail: 'Direct message campaign',
              verified: false,
            },
          ],
        }),
      )

      // The line should not contain " — " (the clientName joiner)
      const proofLine = system
        .split('\n')
        .find((line) => line.includes('[data_point]'))

      expect(proofLine).toBeDefined()
      expect(proofLine).not.toContain(' — ')
    })

    it('injects "NO VERIFIED PROOF" message when proofPoints is an empty array', () => {
      const { system } = buildPass1Prompt(
        baseOpts({ proofPoints: [] }),
      )

      expect(system).toContain('NO VERIFIED PROOF AVAILABLE')
    })

    it('injects "NO VERIFIED PROOF" message when proofPoints is undefined', () => {
      const { system } = buildPass1Prompt(
        baseOpts({ proofPoints: undefined }),
      )

      expect(system).toContain('NO VERIFIED PROOF AVAILABLE')
    })

    it('instructs not to fabricate when proof is unavailable', () => {
      const { system } = buildPass1Prompt(
        baseOpts({ proofPoints: undefined }),
      )

      expect(system).toContain('Do not fabricate case studies')
    })

    it('does NOT show the no-proof message when valid proofPoints are present', () => {
      const { system } = buildPass1Prompt(
        baseOpts({
          proofPoints: [
            {
              type: 'stat',
              headline: 'Users save 5 hours/week',
              detail: 'Internal survey, n=200',
              verified: true,
            },
          ],
        }),
      )

      expect(system).not.toContain('NO VERIFIED PROOF AVAILABLE')
    })
  })

  describe('return shape', () => {
    it('always returns both system and prompt strings', () => {
      const result = buildPass1Prompt(baseOpts())

      expect(typeof result.system).toBe('string')
      expect(typeof result.prompt).toBe('string')
      expect(result.system.length).toBeGreaterThan(0)
      expect(result.prompt.length).toBeGreaterThan(0)
    })

    it('embeds awarenessLevel in the prompt', () => {
      const { prompt } = buildPass1Prompt(baseOpts({ awarenessLevel: 'most-aware' }))

      expect(prompt).toContain('most-aware')
    })

    it('embeds count in the prompt', () => {
      const { prompt } = buildPass1Prompt(baseOpts({ count: 7 }))

      expect(prompt).toContain('7')
    })
  })
})
