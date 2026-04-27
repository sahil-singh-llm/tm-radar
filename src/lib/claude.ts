import type { DetectionResult } from './detection';

export type AnalysisStage = 'idle' | 'pending' | 'domain-only' | 'enriched' | 'unreachable' | 'error';

export type ClaudeAnalysis = {
  text: string;
  stage: AnalysisStage;
  fetchedWebsite: boolean;
};

const MIN_INTERVAL_MS = 2000;
let lastCallAt = 0;
let chain: Promise<unknown> = Promise.resolve();

/** Serialize Claude calls and enforce a minimum 2s gap between requests. */
async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  // Keep chain alive even if individual calls reject.
  chain = next.catch(() => undefined);
  return next;
}

function buildPrompt(
  brandName: string,
  result: DetectionResult,
  websiteContent: string | null,
): string {
  return `You are an expert trademark attorney specializing in domain disputes and brand protection.

BRAND DATA:
- Protected trademark: "${brandName}"
- Suspicious domain: "${result.domain}"
- Technical similarity score: ${result.score}/100
- Detected patterns: ${result.reasons.join(', ')}

${
  websiteContent
    ? `WEBSITE CONTENT (automatically fetched):
"""
${websiteContent}
"""
Incorporate the website content into your analysis.`
    : `WEBSITE: Unreachable or not yet live — analysis based on domain name only.`
}

Provide a structured assessment:

1. SIGN SIMILARITY: How similar is this domain to the trademark and which technique is used?
   (Typosquatting / Homoglyph / Combosquatting / TLD variant / Keyword injection)

2. GOODS & SERVICES SIMILARITY: ${
    websiteContent
      ? 'Based on the website content, does this domain operate in the same industry or offer similar goods/services as the original brand?'
      : 'Cannot be assessed — website unreachable.'
  }

3. LIKELIHOOD OF CONFUSION: Would an average consumer confuse this domain with the original brand?
   (High / Medium / Low / Cannot be assessed)

4. LEGAL ASSESSMENT: Does this likely constitute trademark infringement under UDRP bad faith criteria or EU Trademark Regulation Art. 9 EUTMR?

5. RECOMMENDED ACTION:
   (UDRP Filing / WIPO Arbitration / Cease & Desist / WHOIS Investigation / Monitor / No action needed)

Be concise and legally precise. Maximum 8 sentences total.`;
}

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
};

async function callAnthropic(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = (await res.json()) as AnthropicResponse;
      detail = err?.error?.message ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Claude API error ${res.status}`);
  }

  const data = (await res.json()) as AnthropicResponse;
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  return text.trim();
}

export async function analyzeWithClaude(
  apiKey: string,
  brandName: string,
  result: DetectionResult,
  websiteContent: string | null,
): Promise<string> {
  const prompt = buildPrompt(brandName, result, websiteContent);
  return rateLimited(() => callAnthropic(apiKey, prompt));
}
