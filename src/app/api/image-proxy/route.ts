import { NextRequest, NextResponse } from 'next/server';

/**
 * Image proxy for external ad images that may be blocked by browser security policies.
 * This proxies images from known ad CDNs (Google, Meta, LinkedIn).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate URL is from a known ad CDN
  const allowedDomains = [
    'googlesyndication.com',
    'googleusercontent.com',
    'fbcdn.net',
    'licdn.com',
    // Foreplay CDNs
    'storage.googleapis.com',
    'firebasestorage.googleapis.com',
    'foreplay.co',
    'cdn.foreplay.co',
  ];

  try {
    const parsedUrl = new URL(url);
    const isAllowed = allowedDomains.some((domain) =>
      parsedUrl.hostname.includes(domain)
    );

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Domain not in allowlist' },
        { status: 403 }
      );
    }

    // Fetch the image
    const response = await fetch(url, {
      headers: {
        // No Referer header to avoid potential blocking
        'User-Agent': 'Mozilla/5.0 (compatible; AdLibraryProxy/1.0)',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[ImageProxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
