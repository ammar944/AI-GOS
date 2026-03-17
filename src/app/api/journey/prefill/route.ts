import { auth } from '@clerk/nextjs/server';
import { createTextStreamResponse } from 'ai';
import {
  isLinkedInCompanyUrl,
  isValidUrl,
  runCompanyResearch,
} from '@/lib/company-intel/run-company-research';

export const maxDuration = 180;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { websiteUrl?: string; linkedinUrl?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { websiteUrl, linkedinUrl } = body;

  if (!websiteUrl || typeof websiteUrl !== 'string' || !isValidUrl(websiteUrl)) {
    return new Response(
      JSON.stringify({ error: 'A valid websiteUrl is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (linkedinUrl !== undefined) {
    if (typeof linkedinUrl !== 'string' || !isLinkedInCompanyUrl(linkedinUrl)) {
      return new Response(
        JSON.stringify({
          error:
            'linkedinUrl must be a valid LinkedIn company page URL (e.g., https://linkedin.com/company/acme)',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  console.log('[prefill] Starting research for:', websiteUrl, linkedinUrl ? `+ LinkedIn: ${linkedinUrl}` : '');
  try {
    const result = await runCompanyResearch({ websiteUrl, linkedinUrl });
    console.log('[prefill] Research complete — streaming response');

    // Use createTextStreamResponse for safer stream handling in Next.js 16
    // avoids "Controller is already closed" errors from toTextStreamResponse()
    return createTextStreamResponse({
      textStream: result.textStream,
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[prefill] runCompanyResearch failed:', error);
    return new Response(JSON.stringify({ error: 'Research failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
