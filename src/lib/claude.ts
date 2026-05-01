import type { DetectionResult } from './detection';
import type { BrandProfile } from './brandProfile';

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
  brandProfile: BrandProfile | null,
): string {
  const brandContextBlock = brandProfile
    ? `BRAND CONTEXT (community-curated via Wikidata, NOT a register source — treat as background only, not as proof of rights):
- Mark holder / brand entity: ${brandProfile.label}
- Description: ${brandProfile.description ?? '—'}
- Industry: ${brandProfile.industry ?? '—'}
- Founded / inception: ${brandProfile.inception ?? '—'}
- Country: ${brandProfile.country ?? '—'}

`
    : '';

  return `You are a pre-triage analyst preparing a memo for review by a qualified trademark attorney. Your output is decision support, not legal advice — any enforcement action requires licensed counsel.

CASE DATA:
- Protected trademark: "${brandName}"
- Suspicious domain: "${result.domain}"
- Technical similarity score: ${result.score}/100
- Detected patterns: ${result.reasons.join(', ')}

${brandContextBlock}${
  websiteContent
    ? `WEBSITE CONTENT (automatically fetched):
"""
${websiteContent}
"""
Incorporate this content into the analysis.`
    : `WEBSITE: Unreachable or not yet live — analysis based on domain name only.`
}

Produce a structured triage memo:

1. SIGN SIMILARITY: Identify the squatting technique observed
   (typosquatting / homoglyph / combosquatting / TLD variant / keyword injection / mixed).

2. GOODS & SERVICES INDICATORS: ${
    websiteContent
      ? 'Characterize the apparent goods/services from the fetched site. Note: goods/services overlap, priority dates, and the geographic scope of any registered right are not assessed by this tool (Nice classification is administrative, not the legal test under Art. 9(2)(b) EUTMR; cf. CJEU Canon C-39/97).'
      : 'Cannot be assessed — website unreachable. Flag for re-check once site is live.'
  }

3. CONFUSION-RISK INDICATOR (triage proxy, not the doctrinal Sabel/Canon/Lloyd test): high / medium / low / cannot be assessed.

4. UDRP Paragraph 4(a) LIMBS — map the observed signals to each limb:
   (i) identical or confusingly similar to a mark in which the complainant has rights
   (ii) registrant has no rights or legitimate interests in the domain
   (iii) domain registered and used in bad faith
   Where applicable, reference ¶ 4(b)(i)–(iv) bad-faith circumstances (offer for sale to mark holder, blocking pattern, competitor disruption, commercial gain via confusion).
   If brand context is provided above, use it to characterize the protected mark concretely; do not treat it as a register-verified right.

5. EUTMR Art. 9(2) LIMBS — map signals to:
   (a) identical sign for identical goods/services (double-identity; requires both, do not invoke without a goods/services-identity finding)
   (b) identical or similar sign for similar goods/services, or similar sign for identical goods/services, where there exists a likelihood of confusion (including a likelihood of association)
   (c) use that takes unfair advantage of, or is detrimental to, the distinctive character or the repute of a mark with a reputation (reputation status not verified by this tool; distinct from "well-known marks" under Paris Convention Art. 6bis / TRIPS Art. 16).

6. INDICATORS FOR LEGAL REVIEW: Investigative steps and evidence the reviewing attorney should verify before any enforcement decision (e.g. registrant identity via WHOIS/RDAP, prior use evidence, pattern of similar registrations, registrar/hosting jurisdiction).

Frame all conclusions as observations or indicators, not as recommendations or legal conclusions. Maximum 12 sentences total.`;
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
      max_tokens: 700,
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
  brandProfile: BrandProfile | null = null,
): Promise<string> {
  const prompt = buildPrompt(brandName, result, websiteContent, brandProfile);
  return rateLimited(() => callAnthropic(apiKey, prompt));
}
