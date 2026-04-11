import type { FathomMeeting, FathomMeetingsResponse, FathomTranscriptResponse } from './types';

const FATHOM_API_BASE = 'https://api.fathom.ai/external/v1';

export class FathomResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FathomResolutionError';
  }
}

export interface FathomClient {
  resolveShareUrl(shareUrl: string): Promise<FathomMeeting>;
  fetchTranscript(recordingId: number): Promise<FathomTranscriptResponse>;
}

export function createFathomClient(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): FathomClient {
  const headers = {
    'X-Api-Key': apiKey,
    'Content-Type': 'application/json',
  };

  async function resolveShareUrl(shareUrl: string): Promise<FathomMeeting> {
    const shareId = new URL(shareUrl).pathname.split('/').pop();
    if (!shareId) throw new FathomResolutionError('Invalid share URL format');

    const createdAfter = new Date(Date.now() - 90 * 86400_000).toISOString();
    let cursor: string | null = null;
    let pageCount = 0;
    const maxPages = 20;

    do {
      const params = new URLSearchParams({ limit: '50', created_after: createdAfter });
      if (cursor) params.set('cursor', cursor);

      const res = await fetchFn(`${FATHOM_API_BASE}/meetings?${params}`, { headers });
      if (!res.ok) {
        if (res.status === 401) throw new FathomResolutionError('Fathom API key is invalid or expired');
        if (res.status === 429) throw new FathomResolutionError('Fathom rate limit exceeded — try again in a minute');
        throw new FathomResolutionError(`Fathom API error: ${res.status}`);
      }

      const data: FathomMeetingsResponse = await res.json();
      const match = data.items.find(
        (m) => m.share_url === shareUrl || m.share_url.includes(shareId),
      );
      if (match) return match;

      cursor = data.next_cursor;
      pageCount++;
    } while (cursor && pageCount < maxPages);

    throw new FathomResolutionError(
      'Meeting not found — make sure the link is shared and your Fathom account has access to it',
    );
  }

  async function fetchTranscript(recordingId: number): Promise<FathomTranscriptResponse> {
    const res = await fetchFn(`${FATHOM_API_BASE}/recordings/${recordingId}/transcript`, { headers });
    if (!res.ok) {
      if (res.status === 404) throw new FathomResolutionError('Transcript not found — the call may still be processing');
      throw new FathomResolutionError(`Failed to fetch transcript: ${res.status}`);
    }
    return res.json();
  }

  return { resolveShareUrl, fetchTranscript };
}

export function getFathomClient(): FathomClient {
  const apiKey = process.env.FATHOM_API_KEY;
  if (!apiKey) throw new Error('FATHOM_API_KEY is not set');
  return createFathomClient(apiKey);
}
