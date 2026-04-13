import { describe, it, expect } from 'vitest';
import { classifyDocumentSections } from '../section-tagger';

describe('classifyDocumentSections', () => {
  // ── File name heuristics ──────────────────────────────────────────

  it('classifies pitch-deck.pdf by file name', () => {
    const result = classifyDocumentSections('Some content', 'pitch-deck.pdf');
    expect(result.docKind).toBe('pitch_deck');
    expect(result.sectionTags).toContain('industryMarket');
    expect(result.sectionTags).toContain('offerAnalysis');
    expect(result.sectionTags).toContain('competitors');
    expect(result.sectionTags).toContain('icpValidation');
    expect(result.sectionTags).toContain('crossAnalysis');
  });

  it('classifies icp-research.docx by file name', () => {
    const result = classifyDocumentSections('Anything', 'icp-research.docx');
    expect(result.docKind).toBe('icp_doc');
    expect(result.sectionTags).toContain('icpValidation');
  });

  it('classifies brand-guidelines.pdf by file name', () => {
    const result = classifyDocumentSections('Anything', 'brand-guidelines.pdf');
    expect(result.docKind).toBe('brand_book');
    expect(result.sectionTags).toContain('crossAnalysis');
  });

  it('classifies pricing-sheet.pdf by file name', () => {
    const result = classifyDocumentSections('Anything', 'pricing-sheet.pdf');
    expect(result.docKind).toBe('pricing_sheet');
    expect(result.sectionTags).toContain('offerAnalysis');
  });

  it('classifies competitive-analysis.pdf by file name', () => {
    const result = classifyDocumentSections('Anything', 'competitive-analysis.pdf');
    expect(result.docKind).toBe('competitor_analysis');
    expect(result.sectionTags).toContain('competitors');
  });

  // ── Keyword-based classification ──────────────────────────────────

  it('tags ICP content to icpValidation', () => {
    const text = `
      Our ideal customer profile is a Series A B2B SaaS founder.
      The target audience consists of engineering-led teams with 20-50 employees.
      Key buyer profile characteristics include technical decision makers.
    `;
    const result = classifyDocumentSections(text, 'document.pdf');
    expect(result.sectionTags).toContain('icpValidation');
  });

  it('tags competitor content to competitors', () => {
    const text = `
      Competitive landscape analysis: Our main competitor is Acme Corp.
      In the competitive analysis we found that alternatives include Beta Inc.
      The head-to-head comparison shows clear differentiation.
    `;
    const result = classifyDocumentSections(text, 'report.pdf');
    expect(result.sectionTags).toContain('competitors');
  });

  it('tags pricing content to offerAnalysis', () => {
    const text = `
      Our pricing tiers are structured as follows:
      Starter package: $99/mo, Growth tier: $299/mo.
      Each package includes different deliverables.
    `;
    const result = classifyDocumentSections(text, 'doc.pdf');
    expect(result.sectionTags).toContain('offerAnalysis');
  });

  it('tags market research content to industryMarket', () => {
    const text = `
      Market research indicates the TAM is $4.2B.
      Key industry trends include AI-powered automation.
      Market dynamics show growing demand drivers in the space.
    `;
    const result = classifyDocumentSections(text, 'doc.pdf');
    expect(result.sectionTags).toContain('industryMarket');
  });

  it('tags brand content to crossAnalysis', () => {
    const text = `
      Brand voice guidelines: Professional yet approachable.
      Our positioning statement focuses on premium quality.
      Messaging framework covers key value proposition pillars.
    `;
    const result = classifyDocumentSections(text, 'doc.pdf');
    expect(result.sectionTags).toContain('crossAnalysis');
  });

  it('tags case study content to both offerAnalysis and crossAnalysis', () => {
    const text = `
      Case study: How Acme Corp achieved 3x ROI.
      This success story demonstrates our client results.
      The testimonial highlights transformative outcomes.
    `;
    const result = classifyDocumentSections(text, 'doc.pdf');
    expect(result.sectionTags).toContain('offerAnalysis');
    expect(result.sectionTags).toContain('crossAnalysis');
    expect(result.docKind).toBe('case_study');
  });

  // ── Multi-topic documents ─────────────────────────────────────────

  it('assigns multiple sections for broad documents', () => {
    const text = `
      Our ideal customer profile targets B2B SaaS companies.
      The target audience includes engineering leaders.
      Competitive landscape shows 5 major alternatives.
      Our competitor analysis reveals pricing gaps.
      Market research points to a growing industry trend.
      Market dynamics favor early movers.
    `;
    const result = classifyDocumentSections(text, 'strategy.pdf');
    expect(result.sectionTags).toContain('icpValidation');
    expect(result.sectionTags).toContain('competitors');
    expect(result.sectionTags).toContain('industryMarket');
    expect(result.docKind).toBe('pitch_deck'); // 3+ sections → deck
  });

  // ── Default behavior ──────────────────────────────────────────────

  it('defaults to crossAnalysis for unclassifiable content', () => {
    const text = 'Just some random notes about nothing in particular.';
    const result = classifyDocumentSections(text, 'notes.txt');
    expect(result.sectionTags).toEqual(['crossAnalysis']);
    expect(result.docKind).toBe('other');
  });

  it('defaults to crossAnalysis for very short content', () => {
    const result = classifyDocumentSections('Hello world', 'test.md');
    expect(result.sectionTags).toEqual(['crossAnalysis']);
    expect(result.docKind).toBe('other');
  });

  // ── File name takes priority ──────────────────────────────────────

  it('file name heuristic overrides keyword classification', () => {
    // Content is about pricing, but file name says it's a pitch deck
    const text = 'Our pricing tiers include starter and growth packages.';
    const result = classifyDocumentSections(text, 'sales-deck.pdf');
    expect(result.docKind).toBe('pitch_deck');
    // Pitch deck gets all major sections
    expect(result.sectionTags.length).toBeGreaterThan(3);
  });
});
