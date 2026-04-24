/**
 * Minimal disk cache for SearchAPI responses (and any other URL-keyed fetch).
 *
 * Stores JSON blobs in /tmp/research-competitor-cache/<sha256(url)>.json
 * with a soft TTL. On cache hit and fresh, returns cached value; on miss
 * or stale, calls the fetcher and writes the result.
 *
 * Secrets note: SearchAPI URLs include api_key in query params. The cache
 * key strips `api_key=...` before hashing so switching keys doesn't invalidate
 * the cache, and the stored value is the RESPONSE only — never the request URL.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_CACHE_DIR = process.env.RESEARCH_COMPETITOR_CACHE_DIR
  ?? "/tmp/research-competitor-cache";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function stripSecrets(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("api_key");
    u.searchParams.delete("apiKey");
    u.searchParams.delete("token");
    return u.toString();
  } catch {
    return url.replace(/([?&])api_key=[^&]*/gi, "$1api_key=REDACTED");
  }
}

function keyFor(url: string): string {
  const normalized = stripSecrets(url);
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

interface Envelope<T> {
  cached_at: number;
  ttl_ms: number;
  url_hash_only: string;
  value: T;
}

export async function cachedFetch<T>(
  url: string,
  fetcher: () => Promise<T>,
  opts: { ttlMs?: number; cacheDir?: string; bypass?: boolean } = {},
): Promise<{ value: T; fromCache: boolean }> {
  const dir = opts.cacheDir ?? DEFAULT_CACHE_DIR;
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  ensureDir(dir);

  const key = keyFor(url);
  const file = path.join(dir, `${key}.json`);

  if (!opts.bypass && fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const env = JSON.parse(raw) as Envelope<T>;
      if (Date.now() - env.cached_at <= (env.ttl_ms ?? ttl)) {
        return { value: env.value, fromCache: true };
      }
    } catch {
      // corrupt cache file — fall through to refetch
    }
  }

  const value = await fetcher();
  const env: Envelope<T> = {
    cached_at: Date.now(),
    ttl_ms: ttl,
    url_hash_only: key,
    value,
  };
  try {
    fs.writeFileSync(file, JSON.stringify(env));
  } catch (err) {
    process.stderr.write(
      `[cache] write failed for ${key}: ${(err as Error).message}\n`,
    );
  }
  return { value, fromCache: false };
}

export function cacheStats(cacheDir = DEFAULT_CACHE_DIR): {
  entries: number;
  bytes: number;
  oldest_hours: number;
} {
  if (!fs.existsSync(cacheDir)) return { entries: 0, bytes: 0, oldest_hours: 0 };
  const files = fs.readdirSync(cacheDir).filter((f) => f.endsWith(".json"));
  let bytes = 0;
  let oldest = Date.now();
  for (const f of files) {
    const p = path.join(cacheDir, f);
    try {
      const st = fs.statSync(p);
      bytes += st.size;
      if (st.mtimeMs < oldest) oldest = st.mtimeMs;
    } catch {
      /* ignore */
    }
  }
  return {
    entries: files.length,
    bytes,
    oldest_hours: files.length ? Math.round((Date.now() - oldest) / 36e5) : 0,
  };
}

// CLI: print cache stats or clear cache
if (
  process.argv[1]?.endsWith("cache.ts") ||
  process.argv[1]?.endsWith("cache.js")
) {
  const cmd = process.argv[2];
  if (cmd === "stats") {
    const s = cacheStats();
    process.stdout.write(
      `[cache] ${s.entries} entries · ${(s.bytes / 1024).toFixed(1)}KB · oldest ${s.oldest_hours}h\n`,
    );
  } else if (cmd === "clear") {
    if (fs.existsSync(DEFAULT_CACHE_DIR)) {
      fs.rmSync(DEFAULT_CACHE_DIR, { recursive: true, force: true });
      process.stdout.write(`[cache] cleared ${DEFAULT_CACHE_DIR}\n`);
    }
  } else {
    process.stdout.write(
      `Usage: cache.ts [stats|clear]\n  cache dir: ${DEFAULT_CACHE_DIR}\n`,
    );
  }
}
