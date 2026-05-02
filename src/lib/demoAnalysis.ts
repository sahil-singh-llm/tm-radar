import type { DetectionResult } from './detection';

type TechniqueProfile = {
  name: string;
  signSimilarity: string;
  udrpI: string;
  udrpII: string;
  udrpIII: string;
  udrpB?: string;
  eutmr: string;
  reviewIndicators: string;
};

const PROFILES: Record<DetectionResult['technique'], TechniqueProfile> = {
  typosquatting: {
    name: 'Typosquatting',
    signSimilarity:
      'single-character substitutions that produce visual proximity to the trademark at a glance',
    udrpI:
      'indicator consistent with confusing similarity — minimal edit distance to the mark; final assessment requires the doctrinal Sabel/Canon/Lloyd test',
    udrpII:
      'no facts on registrant available to this tool; legitimate-interest assessment requires WHOIS/RDAP review and check for prior bona fide use',
    udrpIII:
      'pattern consistent with bad-faith registration absent counter-evidence; finding requires evidence of registrant\'s portfolio and intended use',
    udrpB:
      '¶ 4(b)(iv) potentially applicable if commercial use to attract via confusion is later evidenced',
    eutmr:
      '9(2)(b) potentially engaged where goods/services overlap; goods/services similarity must be verified against the register (cf. CJEU Canon C-39/97; Nice classification is administrative, not the legal test)',
    reviewIndicators:
      'WHOIS/RDAP for registrant identity; check registrant\'s portfolio for similar typo registrations; jurisdiction of registrar for venue selection',
  },
  homoglyph: {
    name: 'Homoglyph attack (IDN homograph)',
    signSimilarity:
      'non-Latin homoglyph characters (Cyrillic / accented Latin / digit lookalikes) substituted for visually identical Latin glyphs — an IDN homograph technique commonly associated with credential-phishing operations',
    udrpI:
      'punycode-decoded sign is identical or near-identical to the mark — a strong indicator under the confusing-similarity limb',
    udrpII:
      'IDN-homograph technique rarely accompanies legitimate use; legitimate-interest assessment still requires registrant identification and use evidence',
    udrpIII:
      'Unicode substitution is consistent with bad-faith intent absent counter-evidence; conclusion requires evidence of deceptive use (active phishing infrastructure, registrant\'s prior pattern)',
    udrpB:
      '¶ 4(b)(iv) potentially applicable if credential-harvesting or commercial confusion-use is evidenced',
    eutmr:
      '9(2)(b) potentially engaged on the confusion limb — the punycode-decoded sign is visually identical, but the tool does not assess the goods/services identity required for the 9(2)(a) double-identity rule',
    reviewIndicators:
      'punycode decoding for evidence packaging; abuse reports to registrar and browser vendors; check for active phishing infrastructure on the host',
  },
  combosquatting: {
    name: 'Combosquatting',
    signSimilarity:
      'the trademark embedded as a substring with ancillary terms; the mark forms the dominant element of the domain',
    udrpI:
      'indicator consistent with confusing similarity — the dominant element of the domain is the mark itself',
    udrpII:
      'depends on whether the registrant has bona fide use for the affixed terms; requires WHOIS/RDAP and use-history verification',
    udrpIII:
      'bad-faith assessment depends on use; affixed terms (e.g. "shop", "official") are suggestive but not dispositive — registrant\'s affiliation status is the decisive fact',
    udrpB:
      '¶ 4(b)(iv) potentially applicable if commercial use is later evidenced; ¶ 4(b)(ii) if part of a documented blocking pattern',
    eutmr:
      '9(2)(b) potentially engaged subject to use-in-commerce evaluation and goods/services overlap',
    reviewIndicators:
      'verify registrant relationship to mark holder; check for prior C&D correspondence; document the affix pattern for ¶ 4(b)(ii) argumentation if applicable',
  },
  keyword: {
    name: 'Keyword injection',
    signSimilarity:
      'the trademark paired with a high-risk phishing keyword (login / support / secure / verify); this pattern is commonly associated with credential-harvesting operations',
    udrpI:
      'strong indicator under the confusing-similarity limb — the mark is the dominant element with a recognised lure term',
    udrpII:
      'legitimate-interest assessment unfavourable given the keyword choice; final assessment still requires registrant identification',
    udrpIII:
      'keyword pairing is consistent with bad-faith intent absent counter-evidence; conclusion requires evidence of actual deceptive use',
    udrpB:
      '¶ 4(b)(iv) potentially applicable subject to evidence of commercial confusion-use',
    eutmr:
      '9(2)(b) potentially engaged given the composition; goods/services overlap not assessed by this tool',
    reviewIndicators:
      'check for live phishing content (does the page mimic the brand\'s login flow?); registrar/hosting abuse reports as parallel track to dispute proceedings',
  },
  tld: {
    name: 'TLD variant',
    signSimilarity:
      'the trademark reproduced verbatim under a TLD known for low-cost registration, weak verification, and a high concentration of malicious domains',
    udrpI:
      'strong indicator under the confusing-similarity limb: identical second-level sign, only the TLD differs (TLD is generally disregarded for the confusing-similarity analysis)',
    udrpII:
      'legitimate interest possible but uncommon on these TLDs; assessment requires registrant evidence',
    udrpIII:
      'bad-faith assessment depends on the TLD\'s registration practices and the registrant\'s use',
    udrpB:
      '¶ 4(b)(iii) blocking pattern is common on these TLDs; ¶ 4(b)(iv) potentially applicable if commercial use is evidenced',
    eutmr:
      '9(2)(b) on the confusion limb — the underlying sign is identical (TLD generally disregarded for similarity analysis); the tool does not assess the goods/services identity required for the 9(2)(a) double-identity rule',
    reviewIndicators:
      'for ccTLDs (e.g. .tk) check the registry\'s local dispute policy as UDRP does not apply; gTLDs (.xyz, .click, .top) are UDRP-eligible; document registrant\'s portfolio across other low-cost TLDs',
  },
  mixed: {
    name: 'Multi-vector squatting',
    signSimilarity:
      'multiple techniques layered together (combosquatting + keyword injection + suspicious TLD); the compounding produces higher confusion potential and evades simple detection heuristics',
    udrpI:
      'strong indicator under the confusing-similarity limb — the mark remains recognisable through layered modifications',
    udrpII:
      'legitimate-interest assessment unfavourable given the technique stacking; final assessment requires registrant evidence',
    udrpIII:
      'technique compounding is consistent with bad-faith intent absent counter-evidence; conclusion requires evidence of registrant\'s pattern and use',
    udrpB:
      'multiple ¶ 4(b) limbs may apply: (iv) confusion for gain, (iii) blocking, (ii) pattern',
    eutmr:
      '9(2)(b) potentially engaged; 9(2)(c) potentially applicable if the mark has reputation status (not assessed by this tool)',
    reviewIndicators:
      'document all detected techniques in a single complaint to demonstrate pattern; check for sibling registrations using the same techniques',
  },
};

function confusionLevel(score: number): string {
  if (score >= 92) return 'High indicator';
  if (score >= 80) return 'Medium-to-high indicator';
  return 'Medium indicator';
}

export function generateDemoAnalysis(
  brand: string,
  result: DetectionResult,
  enriched: boolean,
): string {
  const p = PROFILES[result.technique] ?? PROFILES.typosquatting;

  const goods = enriched
    ? `Fetched site presents content suggestive of operations in or adjacent to ${brand}'s primary market. Note: goods/services overlap, priority dates, and the geographic scope of any registered right are not assessed by this tool (Nice classification is administrative, not the legal test under Art. 9(2)(b) EUTMR; cf. CJEU Canon C-39/97).`
    : `Cannot be assessed: website unreachable. Flag for re-check once site is live.`;

  const udrpB = p.udrpB ? `\n   ¶ 4(b) reference: ${p.udrpB}.` : '';

  return `1. SIGN SIMILARITY: ${p.name}. The domain "${result.domain}" employs ${p.signSimilarity} against the trademark "${brand}".

2. GOODS & SERVICES INDICATORS: ${goods}

3. CONFUSION-RISK INDICATOR: ${confusionLevel(result.score)}.

4. UDRP Paragraph 4(a) LIMBS:
   (i) ${p.udrpI};
   (ii) ${p.udrpII};
   (iii) ${p.udrpIII}.${udrpB}

5. EUTMR Art. 9(2) LIMBS: ${p.eutmr}.

6. INDICATORS FOR LEGAL REVIEW: ${p.reviewIndicators}.

Pre-triage memo. Final assessment and any enforcement decision are reserved for a qualified trademark attorney.`;
}
