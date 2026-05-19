// Managed Agents webhook signature verification.
//
// R6 mitigation: signature is verified at HTTP receipt, against the raw
// request body, before any async work (no "queue first, verify later").
// Stale events (created_at older than 5 minutes) are also rejected — Anthropic
// retries do not legitimately arrive that late.
//
// The verification scheme mirrors Anthropic's webhook docs:
//   - Header `anthropic-webhook-signature` carries a header of the form
//     `t=<unix>,v1=<hex>` (timestamped signed payload).
//   - The signed payload is the literal string `${timestamp}.${rawBody}`.
//   - HMAC-SHA256, key derived from the configured webhook secret.

import { createHmac, timingSafeEqual } from 'node:crypto';

const STALE_WINDOW_SECONDS = 5 * 60;

export type SignatureVerificationFailure =
  | 'missing_secret'
  | 'missing_signature_header'
  | 'malformed_signature_header'
  | 'invalid_signature'
  | 'stale_timestamp'
  | 'future_timestamp';

export type SignatureVerificationResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: SignatureVerificationFailure };

export interface VerifySignatureInput {
  rawBody: string;
  signatureHeader: string | null;
  secret: string | null;
  /** Used for testing — defaults to Date.now() / 1000. */
  nowSeconds?: number;
  /** Override the stale window (default 5 minutes). */
  toleranceSeconds?: number;
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function parseSignatureHeader(value: string): {
  timestamp: number;
  signatures: string[];
} | null {
  const parts = value.split(',').map((p) => p.trim());
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex);
    const candidate = part.slice(eqIndex + 1);
    if (key === 't') {
      const parsed = Number.parseInt(candidate, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      timestamp = parsed;
    } else if (key === 'v1') {
      if (candidate.length > 0) signatures.push(candidate);
    }
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export function verifyManagedAgentsSignature(
  input: VerifySignatureInput,
): SignatureVerificationResult {
  if (!input.secret) {
    return { ok: false, reason: 'missing_secret' };
  }
  if (!input.signatureHeader) {
    return { ok: false, reason: 'missing_signature_header' };
  }

  const parsed = parseSignatureHeader(input.signatureHeader);
  if (!parsed) {
    return { ok: false, reason: 'malformed_signature_header' };
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? STALE_WINDOW_SECONDS;
  if (parsed.timestamp + tolerance < now) {
    return { ok: false, reason: 'stale_timestamp' };
  }
  if (parsed.timestamp - tolerance > now) {
    return { ok: false, reason: 'future_timestamp' };
  }

  const signedPayload = `${parsed.timestamp}.${input.rawBody}`;
  const expected = createHmac('sha256', input.secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const matches = parsed.signatures.some((candidate) => safeEqualHex(expected, candidate));
  if (!matches) {
    return { ok: false, reason: 'invalid_signature' };
  }

  return { ok: true, timestamp: parsed.timestamp };
}

/**
 * Test-helper: build a valid signature header for a given body+timestamp.
 * Not exported via the index — only used in unit tests.
 */
export function signManagedAgentsPayload(
  rawBody: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  const signature = createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
