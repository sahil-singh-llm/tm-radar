const CORS_PROXIES: Array<(url: string) => string> = [
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

export async function fetchWebsiteContent(domain: string): Promise<string | null> {
  for (const proxy of CORS_PROXIES) {
    try {
      const target = `https://${domain}`;
      const res = await fetch(proxy(target), {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      let html: string;
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        html = typeof data?.contents === 'string' ? data.contents : '';
      } else {
        html = await res.text();
      }
      if (!html) continue;

      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);

      return text || null;
    } catch {
      continue;
    }
  }
  return null;
}
