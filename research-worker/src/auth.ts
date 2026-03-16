export type WorkerAuthReason =
  | 'development-loopback'
  | 'invalid-key'
  | 'matched-key'
  | 'missing-key';

export interface WorkerAuthDecision {
  authorized: boolean;
  reason: WorkerAuthReason;
}

export interface WorkerAuthInput {
  authHeader: string | undefined;
  environment: string | undefined;
  expectedKey: string | undefined;
  forwardedFor: string | undefined;
  host: string | undefined;
  ip: string | undefined;
  remoteAddress: string | undefined;
}

function normalizeHost(host: string | undefined): string | null {
  if (!host) {
    return null;
  }

  const trimmed = host.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('[')) {
    const closingBracketIndex = trimmed.indexOf(']');
    return closingBracketIndex > 1
      ? trimmed.slice(1, closingBracketIndex).toLowerCase()
      : trimmed.toLowerCase();
  }

  const portSeparatorIndex = trimmed.lastIndexOf(':');
  if (portSeparatorIndex > -1 && trimmed.indexOf(':') === portSeparatorIndex) {
    return trimmed.slice(0, portSeparatorIndex).toLowerCase();
  }

  return trimmed.toLowerCase();
}

function normalizeAddress(address: string | undefined): string | null {
  const normalized = normalizeHost(address);
  return normalized && normalized.length > 0 ? normalized : null;
}

function isLoopbackAddress(address: string | undefined): boolean {
  const normalized = normalizeAddress(address);
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1'
  );
}

function getForwardedAddress(forwardedFor: string | undefined): string | undefined {
  if (!forwardedFor) {
    return undefined;
  }

  const [firstAddress] = forwardedFor.split(',');
  return firstAddress?.trim();
}

function isDevelopmentLoopback(input: WorkerAuthInput): boolean {
  if (input.environment === 'production') {
    return false;
  }

  return (
    isLoopbackAddress(input.host) ||
    isLoopbackAddress(input.ip) ||
    isLoopbackAddress(input.remoteAddress) ||
    isLoopbackAddress(getForwardedAddress(input.forwardedFor))
  );
}

export function authorizeWorkerRequest(input: WorkerAuthInput): WorkerAuthDecision {
  if (!input.expectedKey) {
    return {
      authorized: true,
      reason: 'missing-key',
    };
  }

  if (isDevelopmentLoopback(input)) {
    return {
      authorized: true,
      reason: 'development-loopback',
    };
  }

  if (input.authHeader === `Bearer ${input.expectedKey}`) {
    return {
      authorized: true,
      reason: 'matched-key',
    };
  }

  return {
    authorized: false,
    reason: 'invalid-key',
  };
}
