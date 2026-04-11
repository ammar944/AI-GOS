import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFathomClient } from '../client';
import type { FathomMeetingsResponse, FathomTranscriptResponse } from '../types';

const MOCK_MEETINGS_RESPONSE: FathomMeetingsResponse = {
  limit: 50,
  next_cursor: null,
  items: [
    {
      title: 'Discovery Call — Acme Corp',
      meeting_title: null,
      recording_id: 12345,
      url: 'https://fathom.video/recording/12345',
      share_url: 'https://fathom.video/share/abc123',
      created_at: '2026-04-03T14:00:00Z',
      scheduled_start_time: '2026-04-03T14:00:00Z',
      scheduled_end_time: '2026-04-03T14:42:00Z',
      recording_start_time: '2026-04-03T14:00:30Z',
      recording_end_time: '2026-04-03T14:41:45Z',
      calendar_invitees_domains_type: 'one_or_more_external',
      transcript_language: 'en',
      recorded_by: { name: 'Bob', email: 'bob@agency.com', email_domain: 'agency.com', team: null },
      calendar_invitees: [
        { name: 'Alice', email: 'alice@acme.com', email_domain: 'acme.com', is_external: true, matched_speaker_display_name: 'Alice' },
      ],
      transcript: null,
      default_summary: { template_name: null, markdown_formatted: 'Discussion about paid media strategy...' },
      action_items: [
        { description: 'Send proposal', user_generated: false, completed: false, recording_timestamp: '00:35:00', recording_playback_url: '', assignee: { name: 'Bob', email: 'bob@agency.com', team: null } },
      ],
    },
  ],
};

const MOCK_TRANSCRIPT: FathomTranscriptResponse = {
  transcript: [
    { speaker: { display_name: 'Alice', matched_calendar_invitee_email: 'alice@acme.com' }, text: 'We spend about 15K a month on Google.', timestamp: '00:05:32' },
    { speaker: { display_name: 'Bob', matched_calendar_invitee_email: null }, text: 'What is your biggest challenge?', timestamp: '00:05:38' },
    { speaker: { display_name: 'Alice', matched_calendar_invitee_email: 'alice@acme.com' }, text: 'We cannot track ROAS across channels.', timestamp: '00:05:45' },
  ],
};

describe('resolveShareUrl', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('resolves a share URL to a meeting object', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_MEETINGS_RESPONSE),
    });
    const client = createFathomClient('test-api-key', mockFetch);
    const meeting = await client.resolveShareUrl('https://fathom.video/share/abc123');
    expect(meeting.recording_id).toBe(12345);
    expect(meeting.title).toBe('Discovery Call — Acme Corp');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/meetings'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Api-Key': 'test-api-key' }),
      }),
    );
  });

  it('throws when meeting not found', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ limit: 50, next_cursor: null, items: [] }),
    });
    const client = createFathomClient('test-api-key', mockFetch);
    await expect(client.resolveShareUrl('https://fathom.video/share/nonexistent'))
      .rejects.toThrow('Meeting not found');
  });

  it('paginates through results', async () => {
    const page1: FathomMeetingsResponse = {
      limit: 50, next_cursor: 'cursor-2',
      items: [{ ...MOCK_MEETINGS_RESPONSE.items[0], share_url: 'https://fathom.video/share/other' }],
    };
    const page2: FathomMeetingsResponse = {
      limit: 50, next_cursor: null,
      items: [MOCK_MEETINGS_RESPONSE.items[0]],
    };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page1) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page2) });
    const client = createFathomClient('test-api-key', mockFetch);
    const meeting = await client.resolveShareUrl('https://fathom.video/share/abc123');
    expect(meeting.recording_id).toBe(12345);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('fetchTranscript', () => {
  it('fetches transcript by recording ID', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_TRANSCRIPT),
    });
    const client = createFathomClient('test-api-key', mockFetch);
    const result = await client.fetchTranscript(12345);
    expect(result.transcript).toHaveLength(3);
    expect(result.transcript[0].speaker.display_name).toBe('Alice');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/recordings/12345/transcript'),
      expect.anything(),
    );
  });
});
