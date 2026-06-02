/**
 * Domains that require proxying through /api/image-proxy for CORS.
 * Covers Meta (fbcdn.net), LinkedIn (licdn.com), Google CDN, and Foreplay
 * (foreplay.co / r2.foreplay.co) creative-asset domains.
 */
export const PROXY_DOMAINS = [
  'googlesyndication.com',
  'googleusercontent.com',
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
  'fbcdn.net',
  'licdn.com',
  'foreplay.co',
  'r2.foreplay.co',
];

export function shouldUseProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return PROXY_DOMAINS.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

export function getProxyUrl(url: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}
