import { describe, it, expect } from 'vitest';
import {
  detectCompetitorMentions,
  type CompetitorDetection,
} from '../competitor-detector';

describe('detectCompetitorMentions', () => {
  // ── URL patterns ────────────────────────────────────────────────────────────

  it('extracts bare HTTPS URL', () => {
    const result = detectCompetitorMentions('check out https://www.hubspot.com');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('hubspot.com');
    expect(result!.rawMention).toBe('https://www.hubspot.com');
  });

  it('extracts bare HTTP URL', () => {
    const result = detectCompetitorMentions('our competitor is at http://pagerduty.com');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('pagerduty.com');
  });

  it('extracts domain-only URLs (no protocol) with known TLDs', () => {
    const result = detectCompetitorMentions('We compete with datadog.com and grafana.io');
    expect(result).not.toBeNull();
    expect(result!.domain).toMatch(/datadog\.com|grafana\.io/);
  });

  it('extracts domain from .io TLD', () => {
    const result = detectCompetitorMentions('main competitor is linear.io');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('linear.io');
  });

  it('extracts domain from .ai TLD', () => {
    const result = detectCompetitorMentions('competing with jasper.ai');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('jasper.ai');
  });

  it('extracts domain from .co TLD', () => {
    const result = detectCompetitorMentions('check buffer.co out');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('buffer.co');
  });

  // ── Phrase patterns ──────────────────────────────────────────────────────────

  it('detects "my competitor is X" pattern and infers domain', () => {
    const result = detectCompetitorMentions('My competitor is PagerDuty');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('pagerduty.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "main competitor is X" pattern', () => {
    const result = detectCompetitorMentions('our main competitor is HubSpot');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('hubspot.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "we compete with X" pattern', () => {
    const result = detectCompetitorMentions('we compete with Salesforce');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('salesforce.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "competing against X" pattern', () => {
    const result = detectCompetitorMentions('We are competing against Datadog');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('datadog.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "rival is X" pattern', () => {
    const result = detectCompetitorMentions('our main rival is Intercom');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('intercom.com');
    expect(result!.inferredDomain).toBe(true);
  });

  it('detects "competitors are X, Y" and returns first match', () => {
    const result = detectCompetitorMentions('my competitors are HubSpot and Salesforce');
    expect(result).not.toBeNull();
    // Returns the first detected domain
    expect(result!.domain).toMatch(/hubspot\.com|salesforce\.com/);
  });

  // ── Domain normalisation ──────────────────────────────────────────────────────

  it('strips www. prefix from extracted domains', () => {
    const result = detectCompetitorMentions('https://www.stripe.com/pricing');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('stripe.com');
  });

  it('strips path from URL when extracting domain', () => {
    const result = detectCompetitorMentions('see https://linear.app/pricing');
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('linear.app');
  });

  it('lowercases the domain', () => {
    const result = detectCompetitorMentions('competitor is HubSpot.COM');
    // Domain inference from company name lowercases it
    if (result) {
      expect(result.domain).toBe(result.domain.toLowerCase());
    }
  });

  // ── Negative cases ──────────────────────────────────────────────────────────

  it('returns null for plain text with no competitor signals', () => {
    const result = detectCompetitorMentions('We are a B2B SaaS company in DevOps');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectCompetitorMentions('')).toBeNull();
  });

  it('returns null for "I don\'t know my competitors"', () => {
    const result = detectCompetitorMentions("I don't know who my competitors are");
    expect(result).toBeNull();
  });

  it('returns null for "no direct competitors"', () => {
    const result = detectCompetitorMentions('we have no direct competitors');
    expect(result).toBeNull();
  });

  it('does not false-positive on generic business words', () => {
    const result = detectCompetitorMentions('We want to compete in the enterprise market');
    expect(result).toBeNull();
  });

  it('does not false-positive on email addresses', () => {
    const result = detectCompetitorMentions('contact us at hello@example.com');
    expect(result).toBeNull();
  });
});
