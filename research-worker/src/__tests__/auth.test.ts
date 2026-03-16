import { describe, expect, it } from 'vitest';
import { authorizeWorkerRequest } from '../auth';

describe('authorizeWorkerRequest', () => {
  it('allows requests when no worker API key is configured', () => {
    const result = authorizeWorkerRequest({
      authHeader: undefined,
      expectedKey: undefined,
      environment: 'development',
      host: 'localhost:3001',
      ip: '127.0.0.1',
      remoteAddress: '127.0.0.1',
      forwardedFor: undefined,
    });

    expect(result.authorized).toBe(true);
    expect(result.reason).toBe('missing-key');
  });

  it('allows loopback requests in non-production even when the auth header is missing', () => {
    const result = authorizeWorkerRequest({
      authHeader: undefined,
      expectedKey: 'secret',
      environment: 'development',
      host: 'localhost:3001',
      ip: '127.0.0.1',
      remoteAddress: '::1',
      forwardedFor: undefined,
    });

    expect(result.authorized).toBe(true);
    expect(result.reason).toBe('development-loopback');
  });

  it('rejects non-loopback requests in non-production when the auth header is missing', () => {
    const result = authorizeWorkerRequest({
      authHeader: undefined,
      expectedKey: 'secret',
      environment: 'development',
      host: '192.168.0.42:3001',
      ip: '192.168.0.42',
      remoteAddress: '192.168.0.42',
      forwardedFor: undefined,
    });

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('invalid-key');
  });

  it('rejects loopback requests in production when the auth header is missing', () => {
    const result = authorizeWorkerRequest({
      authHeader: undefined,
      expectedKey: 'secret',
      environment: 'production',
      host: 'localhost:3001',
      ip: '127.0.0.1',
      remoteAddress: '127.0.0.1',
      forwardedFor: undefined,
    });

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('invalid-key');
  });

  it('allows matching bearer tokens in production', () => {
    const result = authorizeWorkerRequest({
      authHeader: 'Bearer secret',
      expectedKey: 'secret',
      environment: 'production',
      host: 'worker.internal',
      ip: '10.0.0.1',
      remoteAddress: '10.0.0.1',
      forwardedFor: '10.0.0.1',
    });

    expect(result.authorized).toBe(true);
    expect(result.reason).toBe('matched-key');
  });
});
