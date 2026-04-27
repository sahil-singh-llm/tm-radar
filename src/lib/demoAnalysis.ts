import type { DetectionResult } from './detection';

type TechniqueProfile = {
  name: string;
  signSimilarity: string;
  udrp: string;
  eutmr: string;
  recommendation: string;
};

const PROFILES: Record<DetectionResult['technique'], TechniqueProfile> = {
  typosquatting: {
    name: 'Typosquatting',
    signSimilarity:
      'single-character substitutions intended to be visually indistinguishable from the original at a glance',
    udrp: 'Strong indicators of bad-faith registration under UDRP §4(b)(iv)',
    eutmr: 'EUTMR Art. 9(2)(b) is squarely engaged given the near-identical sign',
    recommendation: 'UDRP Filing — proceed with WIPO complaint after WHOIS investigation',
  },
  homoglyph: {
    name: 'Homoglyph attack (IDN homograph)',
    signSimilarity:
      'non-Latin homoglyph characters (Cyrillic / accented Latin / digit lookalikes) substituted for visually identical Latin glyphs — a textbook IDN homograph technique typically used for credential phishing',
    udrp: 'Almost certain bad-faith registration under UDRP §4(b)(iv)',
    eutmr: 'EUTMR Art. 9(2)(a) — the sign is identical for practical purposes',
    recommendation:
      'UDRP Filing immediately + parallel registrar abuse report + browser-vendor notification',
  },
  combosquatting: {
    name: 'Combosquatting',
    signSimilarity:
      'the trademark embedded as a substring with ancillary terms — the mark dominates the visual identity of the domain',
    udrp: 'Likely actionable under UDRP §4(b)(iv) when registrant has no legitimate interest',
    eutmr: 'EUTMR Art. 9(2)(b) is engaged, subject to use-in-commerce evaluation',
    recommendation: 'WHOIS Investigation → Cease & Desist → UDRP if non-responsive',
  },
  keyword: {
    name: 'Keyword injection',
    signSimilarity:
      'the trademark paired with a high-risk phishing keyword (login / support / secure / verify) — a pattern overwhelmingly associated with credential-harvesting operations',
    udrp: 'Strong bad-faith indicator under UDRP §4(b)(iv); the keyword pairing is itself probative of intent',
    eutmr: 'EUTMR Art. 9(2)(b) clearly engaged',
    recommendation:
      'Expedited UDRP Filing + abuse report to registrar and hosting provider',
  },
  tld: {
    name: 'TLD variant',
    signSimilarity:
      'the trademark reproduced verbatim under a TLD known for low-cost registration, weak verification, and a high concentration of malicious domains',
    udrp: 'Squarely within UDRP §4(a) — identical sign on a different TLD',
    eutmr: 'EUTMR Art. 9(2)(a) applies on the identical-sign limb',
    recommendation:
      'UDRP Filing — these matters are typically straightforward to win on the merits',
  },
  mixed: {
    name: 'Multi-vector squatting',
    signSimilarity:
      'multiple techniques layered together (combosquatting + keyword injection + suspicious TLD) — deliberate compounding to maximize confusion and evade simple detection',
    udrp:
      'The compounding of techniques is itself probative of bad faith under UDRP §4(b)(iv)',
    eutmr: 'EUTMR Art. 9(2)(b) clearly engaged',
    recommendation: 'UDRP Filing with detailed pattern documentation in the complaint',
  },
};

function confusionLevel(score: number): string {
  if (score >= 92) return 'High';
  if (score >= 80) return 'Medium-to-High';
  return 'Medium';
}

export function generateDemoAnalysis(
  brand: string,
  result: DetectionResult,
  enriched: boolean,
): string {
  const p = PROFILES[result.technique] ?? PROFILES.typosquatting;
  const goods = enriched
    ? `Apparent overlap. The fetched site presents content suggestive of operations adjacent to or competing with ${brand}'s primary market, which materially strengthens the goods/services similarity finding.`
    : `Cannot be assessed — website unreachable at the time of certificate issuance.`;

  return `1. SIGN SIMILARITY: ${p.name}. The domain "${result.domain}" employs ${p.signSimilarity} against the trademark "${brand}".

2. GOODS & SERVICES SIMILARITY: ${goods}

3. LIKELIHOOD OF CONFUSION: ${confusionLevel(result.score)}. An average consumer is likely to assume affiliation with ${brand}.

4. LEGAL ASSESSMENT: ${p.udrp}. ${p.eutmr}.

5. RECOMMENDED ACTION: ${p.recommendation}.`;
}
