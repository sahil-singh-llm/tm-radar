/**
 * Fetches a homepage screenshot via microlink.io's free tier (~50 req/day,
 * no API key required for public use). Returns a signed image URL hosted on
 * microlink's CDN, or null if the target is unreachable / quota exhausted.
 */
const MICROLINK_BASE = 'https://api.microlink.io';
const TIMEOUT_MS = 20_000;

type MicrolinkResponse = {
  status?: string;
  data?: {
    screenshot?: {
      url?: string;
    };
  };
};

export async function fetchScreenshotUrl(domain: string): Promise<string | null> {
  const target = `https://${domain}`;
  const apiUrl = `${MICROLINK_BASE}?url=${encodeURIComponent(target)}&screenshot=true&meta=false`;
  try {
    const res = await fetch(apiUrl, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MicrolinkResponse;
    if (data.status !== 'success') return null;
    return data.data?.screenshot?.url ?? null;
  } catch {
    return null;
  }
}
