import { describe, expect, it } from 'vitest';

import {
  signManagedAgentsPayload,
  verifyManagedAgentsSignature,
} from '../signature';

const SECRET = 'whsec_test_secret';

describe('verifyManagedAgentsSignature', () => {
  it('rejects when no secret is configured (R6)', () => {
    const result = verifyManagedAgentsSignature({
      rawBody: '{}',
      signatureHeader: 't=1,v1=deadbeef',
      secret: null,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('missing_secret');
  });

  it('rejects when the signature header is missing (R6)', () => {
    const result = verifyManagedAgentsSignature({
      rawBody: '{}',
      signatureHeader: null,
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('missing_signature_header');
  });

  it('rejects a malformed signature header', () => {
    const result = verifyManagedAgentsSignature({
      rawBody: '{}',
      signatureHeader: 'totally-bogus',
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('malformed_signature_header');
  });

  it('accepts a valid signature within the freshness window (R6)', () => {
    const body = '{"event_id":"evt_1","type":"agent.message"}';
    const now = 1_700_000_000;
    const header = signManagedAgentsPayload(body, SECRET, now);
    const result = verifyManagedAgentsSignature({
      rawBody: body,
      signatureHeader: header,
      secret: SECRET,
      nowSeconds: now + 30, // 30 seconds later
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a forged signature (R6)', () => {
    const body = '{"event_id":"evt_1"}';
    const now = 1_700_000_000;
    const validHeader = signManagedAgentsPayload(body, SECRET, now);
    const tampered = validHeader.replace(/=[0-9a-f]+$/, '=00');
    const result = verifyManagedAgentsSignature({
      rawBody: body,
      signatureHeader: tampered,
      secret: SECRET,
      nowSeconds: now,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('invalid_signature');
  });

  it('rejects a stale timestamp older than the freshness window (R6)', () => {
    const body = '{"event_id":"evt_1"}';
    const old = 1_700_000_000;
    const header = signManagedAgentsPayload(body, SECRET, old);
    const result = verifyManagedAgentsSignature({
      rawBody: body,
      signatureHeader: header,
      secret: SECRET,
      // 10 minutes later — beyond the 5-minute default tolerance.
      nowSeconds: old + 10 * 60,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('stale_timestamp');
  });

  it('rejects a future timestamp far ahead of the freshness window', () => {
    const body = '{"event_id":"evt_1"}';
    const future = 1_700_000_000;
    const header = signManagedAgentsPayload(body, SECRET, future);
    const result = verifyManagedAgentsSignature({
      rawBody: body,
      signatureHeader: header,
      secret: SECRET,
      nowSeconds: future - 10 * 60,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('future_timestamp');
  });
});
