import { describe, it, expect } from 'vitest';
import { buildErrorResponse } from '../error-response';

describe('buildErrorResponse', () => {
  it('returns structured error with all fields', () => {
    const result = buildErrorResponse(
      'researchIndustry',
      'Railway worker returned 503 after 3 retries',
      35000,
    );

    expect(result).toEqual({
      error: true,
      attempted: 'researchIndustry',
      reason: 'Railway worker returned 503 after 3 retries',
      duration: '35.0s',
      suggestion: expect.any(String),
      canRetry: false,
    });
  });

  it('marks retryable errors correctly', () => {
    const result = buildErrorResponse(
      'researchICP',
      'Rate limited',
      5000,
      { canRetry: true },
    );
    expect(result.canRetry).toBe(true);
  });

  it('includes custom suggestion when provided', () => {
    const result = buildErrorResponse(
      'researchOffer',
      'Timeout',
      120000,
      { suggestion: 'Try with less context' },
    );
    expect(result.suggestion).toBe('Try with less context');
  });

  it('uses default suggestion for known tools', () => {
    const result = buildErrorResponse('researchIndustry', 'Failed', 1000);
    expect(result.suggestion).toBe(
      'Proceed with onboarding. Industry research can be retried later.',
    );
  });

  it('uses generic suggestion for unknown tools', () => {
    const result = buildErrorResponse('unknownTool', 'Failed', 1000);
    expect(result.suggestion).toBe('Continue with available data.');
  });
});
