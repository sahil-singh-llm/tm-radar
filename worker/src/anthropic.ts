import type { AnalyzeRequest } from './types';

const SYSTEM_PROMPT = `You are a pre-triage analyst preparing a memo for review by a qualified trademark attorney. Your output is decision support, not legal advice — any enforcement action requires licensed counsel.

Produce a structured triage memo with the following sections, in order:

1. SIGN SIMILARITY: Identify the squatting technique observed
   (typosquatting / homoglyph / combosquatting / TLD variant / keyword injection / mixed).

2. GOODS & SERVICES INDICATORS: When website content is provided in CASE DATA, characterize the apparent goods/services from the fetched site. When the website is marked unreachable, state that this cannot be assessed and flag for re-check once the site is live. Note: goods/services overlap, priority dates, and the geographic scope of any registered right are not assessed by this tool (Nice classification is administrative, not the legal test under Art. 9(2)(b) EUTMR; cf. CJEU Canon C-39/97).

3. CONFUSION-RISK INDICATOR (triage proxy, not the doctrinal Sabel/Canon/Lloyd test): high / medium / low / cannot be assessed.

4. UDRP Paragraph 4(a) LIMBS — map the observed signals to each limb:
   (i) identical or confusingly similar to a mark in which the complainant has rights
   (ii) registrant has no rights or legitimate interests in the domain
   (iii) domain registered and used in bad faith
   Where applicable, reference ¶ 4(b)(i)–(iv) bad-faith circumstances (offer for sale to mark holder, blocking pattern, competitor disruption, commercial gain via confusion).
   If brand context is provided, use it to characterize the protected mark concretely; do not treat it as a register-verified right.

5. EUTMR Art. 9(2) LIMBS — map signals to:
   (a) identical sign for identical goods/services (double-identity; requires both, do not invoke without a goods/services-identity finding)
   (b) identical or similar sign for similar goods/services, or similar sign for identical goods/services, where there exists a likelihood of confusion (including a likelihood of association)
   (c) use that takes unfair advantage of, or is detrimental to, the distinctive character or the repute of a mark with a reputation (reputation status not verified by this tool; distinct from "well-known marks" under Paris Convention Art. 6bis / TRIPS Art. 16).

6. INDICATORS FOR LEGAL REVIEW: Investigative steps and evidence the reviewing attorney should verify before any enforcement decision (e.g. registrant identity via WHOIS/RDAP, prior use evidence, pattern of similar registrations, registrar/hosting jurisdiction).

LANGUAGE DISCIPLINE — observe strictly in every section above:
- Do NOT state that a UDRP limb or EUTMR sub-paragraph is "satisfied", "met", "established", "fulfilled", or "engaged" as a finding. Phrase as "indicator consistent with [limb]", "potentially engaged subject to verification of X", or "preliminary signal supporting [limb] absent counter-evidence".
- Do NOT assert bad faith from the squatting technique alone. Phrase as "consistent with bad-faith intent absent counter-evidence; conclusion requires evidence of registrant's portfolio, prior C&D correspondence, and active use".
- Where a fact is unknown to this tool (registrant identity, registered class scope, prior bona fide use, mark distinctiveness, reputation status), explicitly mark it "not assessed by this tool" rather than implying a conclusion.
- Avoid intent-imputing verbs ("intended to", "deliberately", "designed to deceive"). Describe the technique's effect, not the registrant's mental state.

Frame all conclusions as observations or indicators, not as recommendations or legal conclusions. Maximum 12 sentences total.`;

function buildUserMessage(req: AnalyzeRequest): string {
  const brandContext = req.brandProfile
    ? `
BRAND CONTEXT (community-curated via Wikidata, NOT a register source — treat as background only, not as proof of rights):
- Mark holder / brand entity: ${req.brandProfile.label}
- Description: ${req.brandProfile.description ?? '—'}
- Industry: ${req.brandProfile.industry ?? '—'}
- Founded / inception: ${req.brandProfile.inception ?? '—'}
- Country: ${req.brandProfile.country ?? '—'}
`
    : '';

  const websiteBlock = req.websiteContent
    ? `
WEBSITE CONTENT (automatically fetched):
"""
${req.websiteContent}
"""
Incorporate this content into the analysis.`
    : `
WEBSITE: Unreachable or not yet live — analysis based on domain name only.`;

  return `CASE DATA:
- Protected trademark: "${req.brand}"
- Suspicious domain: "${req.domain}"
- Technical similarity score: ${req.score}/100
- Detected patterns: ${req.reasons.join(', ')}
${brandContext}${websiteBlock}`;
}

export type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export type AnthropicResult = {
  text: string;
  usage: AnthropicUsage;
};

export async function callAnthropic(
  apiKey: string,
  model: string,
  maxTokens: number,
  req: AnalyzeRequest,
): Promise<AnthropicResult> {
  const userMessage = buildUserMessage(req);

  const body = {
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      detail = err?.error?.message ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Anthropic ${res.status}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: AnthropicUsage;
  };
  const text = (data.content?.find((c) => c.type === 'text')?.text ?? '').trim();
  const usage = data.usage ?? { input_tokens: 0, output_tokens: 0 };
  return { text, usage };
}

type Pricing = { input: number; output: number; cacheWrite: number; cacheRead: number };

// $/M tokens → also = micro-USD per token (since 1$/M = 1e-6 $/token = 1 micro-USD/token).
// Update if Anthropic pricing changes.
const PRICING: Record<string, Pricing> = {
  'claude-sonnet-4-6': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

export function estimateCostMicroUsd(model: string, usage: AnthropicUsage): number {
  const p = PRICING[model] ?? PRICING['claude-sonnet-4-6'];
  const cost =
    usage.input_tokens * p.input +
    usage.output_tokens * p.output +
    (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
    (usage.cache_read_input_tokens ?? 0) * p.cacheRead;
  return Math.ceil(cost);
}
