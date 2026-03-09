import { auth } from '@clerk/nextjs/server';
import {
  isLinkedInCompanyUrl,
  isValidUrl,
  runCompanyResearch,
} from '@/lib/company-intel/run-company-research';

export const maxDuration = 120;

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
    console.log('[prefill] streamObject created — starting stream response');
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[prefill] runCompanyResearch failed:', error);
    return new Response(JSON.stringify({ error: 'Research failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
