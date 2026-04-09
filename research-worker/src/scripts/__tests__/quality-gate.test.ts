import { describe, it, expect } from 'vitest';
import { runQualityGate } from '../stages/05-quality-gate/quality-gate';

describe('quality gate', () => {
  describe('dash elimination', () => {
    it('removes em dashes from all string fields', () => {
      const { script } = runQualityGate({
        script: { body: 'This is great — really great', headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      expect(script.body).not.toContain('—');
      expect(script.body).toContain('. ');
    });

    it('removes en dashes', () => {
      const { script } = runQualityGate({
        script: { body: 'From 500–5000 users', headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      expect(script.body).not.toContain('–');
      expect(script.body).toContain('500 to 5000');
    });

    it('handles unspaced dashes', () => {
      const { script } = runQualityGate({
        script: { body: 'Revenue—growth matters', headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      expect(script.body).not.toContain('—');
      expect(script.body).toContain('Revenue, growth');
    });

    it('processes hookVariants arrays', () => {
      const { script } = runQualityGate({
        script: { body: 'Clean body', headline: 'Test', hookVariants: ['Hook — one', 'Hook two'] },
        platform: 'meta',
        format: 'video',
      });
      const variants = script.hookVariants as string[];
      expect(variants[0]).not.toContain('—');
      expect(variants[1]).toBe('Hook two');
    });
  });

  describe('kill list tier 1', () => {
    it('replaces "leverage" with "use"', () => {
      const { script, report } = runQualityGate({
        script: { body: 'Leverage our platform for growth', headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      expect(script.body).toContain('use');
      expect(script.body).not.toMatch(/\bleverage\b/i);
      expect(report.autoFixed).toBeGreaterThan(0);
    });

    it('replaces "utilize" with "use"', () => {
      const { script } = runQualityGate({
        script: { body: 'We utilize advanced technology', headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      expect(script.body).toContain('use');
    });

    it('replaces "robust" with "strong"', () => {
      const { script } = runQualityGate({
        script: { body: 'A robust solution for teams', headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      expect(script.body).toContain('strong');
    });
  });

  describe('banned phrases', () => {
    it('flags "in today\'s landscape"', () => {
      const { report } = runQualityGate({
        script: { body: "In today's landscape, we do X", headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      const banned = report.violations.filter((v) => v.check === 'banned-phrase');
      expect(banned.length).toBeGreaterThan(0);
    });

    it('flags chatbot closers', () => {
      const { report } = runQualityGate({
        script: { body: 'Great results. Let me know if you have any questions.', headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      const closers = report.violations.filter((v) => v.check === 'chatbot-closer');
      expect(closers.length).toBeGreaterThan(0);
    });
  });

  describe('character limits', () => {
    it('fails when meta headline exceeds 40 chars', () => {
      const longHeadline = 'A'.repeat(50);
      const { report } = runQualityGate({
        script: { headline: longHeadline, body: 'Short body' },
        platform: 'meta',
        format: 'static',
      });
      const charViolations = report.violations.filter((v) => v.check === 'char-limit');
      expect(charViolations.length).toBeGreaterThan(0);
      expect(report.passed).toBe(false);
    });

    it('passes when headline is within limit', () => {
      const { report } = runQualityGate({
        script: { headline: 'Short headline', body: 'Body text' },
        platform: 'meta',
        format: 'static',
      });
      const charFails = report.violations.filter((v) => v.check === 'char-limit' && v.severity === 'fail');
      expect(charFails).toHaveLength(0);
    });
  });

  describe('sentence rhythm', () => {
    it('flags uniform sentence lengths', () => {
      const uniformBody = 'This is a medium sentence here. This is another medium sentence. This is yet another medium one. And here is one more medium sentence.';
      const { report } = runQualityGate({
        script: { body: uniformBody, headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      const rhythm = report.violations.filter((v) => v.check.startsWith('sentence-rhythm'));
      expect(rhythm.length).toBeGreaterThan(0);
    });
  });

  describe('rule of three', () => {
    it('flags triplet patterns', () => {
      const { report } = runQualityGate({
        script: { body: 'We are fast, reliable, and affordable.', headline: 'Test' },
        platform: 'meta',
        format: 'video',
      });
      const ruleOfThree = report.violations.filter((v) => v.check === 'rule-of-three');
      expect(ruleOfThree.length).toBeGreaterThan(0);
    });
  });

  describe('report summary', () => {
    it('clean copy passes with zero violations', () => {
      const { report } = runQualityGate({
        script: { body: 'Get 40% more leads. Two hours a week. No overhead.', headline: 'More leads' },
        platform: 'meta',
        format: 'video',
      });
      expect(report.failures).toBe(0);
      expect(report.passed).toBe(true);
    });
  });
});
