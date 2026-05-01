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
      'single-character substitutions intended to be visually indistinguishable from the trademark at a glance',
    udrpI:
      'likely satisfied: domain is confusingly similar to the protected mark via a minimal-edit-distance variation',
    udrpII:
      'no apparent legitimate interest evident from the registration pattern; a real review must verify via WHOIS/RDAP',
    udrpIII:
      'bad-faith inference plausible; supporting evidence required',
    udrpB:
      '¶ 4(b)(iv): likely use to attract users for commercial gain via confusion',
    eutmr:
      '9(2)(b) engaged where goods/services overlap; goods/services similarity must be verified against the register (cf. CJEU Canon C-39/97; Nice classification is administrative, not the legal test)',
    reviewIndicators:
      'WHOIS/RDAP for registrant identity; check registrant\'s portfolio for similar typo registrations; jurisdiction of registrar for venue selection',
  },
  homoglyph: {
    name: 'Homoglyph attack (IDN homograph)',
    signSimilarity:
      'non-Latin homoglyph characters (Cyrillic / accented Latin / digit lookalikes) substituted for visually identical Latin glyphs (an IDN homograph technique typically deployed for credential phishing)',
    udrpI:
      'satisfied: the punycode-decoded sign is effectively identical to the mark',
    udrpII:
      'legitimate interest highly unlikely given the technique\'s phishing-specific nature',
    udrpIII:
      'strong bad-faith inference; the deliberate Unicode substitution is itself probative of intent',
    udrpB:
      '¶ 4(b)(iv): designed to attract users via confusion for commercial gain (often credential harvesting)',
    eutmr:
      '9(2)(b) on the confusion limb — the punycode-decoded sign is visually identical, but the tool does not assess the goods/services identity required for the 9(2)(a) double-identity rule',
    reviewIndicators:
      'punycode decoding for evidence packaging; abuse reports to registrar and browser vendors; check for active phishing infrastructure on the host',
  },
  combosquatting: {
    name: 'Combosquatting',
    signSimilarity:
      'the trademark embedded as a substring with ancillary terms; the mark dominates the visual identity of the domain',
    udrpI:
      'plausibly satisfied: the dominant component of the domain is the mark itself',
    udrpII:
      'depends on whether the registrant has any legitimate use for the affixed terms; requires verification',
    udrpIII:
      'bad-faith inference depends on use; the affixed terms (e.g. "shop", "official") are themselves probative when the registrant is unaffiliated',
    udrpB:
      '¶ 4(b)(iv) where commercial use is observed; ¶ 4(b)(ii) if part of a blocking pattern',
    eutmr:
      '9(2)(b) is engaged subject to use-in-commerce evaluation and goods/services overlap',
    reviewIndicators:
      'verify registrant relationship to mark holder; check for prior C&D correspondence; document the affix pattern for ¶ 4(b)(ii) argumentation if applicable',
  },
  keyword: {
    name: 'Keyword injection',
    signSimilarity:
      'the trademark paired with a high-risk phishing keyword (login / support / secure / verify), a pattern overwhelmingly associated with credential-harvesting operations',
    udrpI:
      'satisfied: the mark is the dominant component, the keyword is an unmistakable lure term',
    udrpII:
      'legitimate interest highly improbable given the keyword choice',
    udrpIII:
      'strong bad-faith inference; the keyword pairing is itself probative of intent to deceive',
    udrpB:
      '¶ 4(b)(iv): explicit attempt to attract users via confusion for commercial gain',
    eutmr:
      '9(2)(b) clearly engaged given the deceptive composition',
    reviewIndicators:
      'check for live phishing content (does the page mimic the brand\'s login flow?); registrar/hosting abuse reports as parallel track to dispute proceedings',
  },
  tld: {
    name: 'TLD variant',
    signSimilarity:
      'the trademark reproduced verbatim under a TLD known for low-cost registration, weak verification, and a high concentration of malicious domains',
    udrpI:
      'satisfied: identical sign, only the TLD differs (the TLD is generally disregarded for confusing-similarity analysis)',
    udrpII:
      'legitimate interest possible but uncommon on these TLDs; requires verification',
    udrpIII:
      'bad-faith inference depends on the TLD\'s registration practices and the registrant\'s use',
    udrpB:
      '¶ 4(b)(iii) blocking pattern is common; ¶ 4(b)(iv) where commercial use exists',
    eutmr:
      '9(2)(b) on the confusion limb — the underlying sign is identical (TLD generally disregarded for similarity analysis), but the tool does not assess the goods/services identity required for the 9(2)(a) double-identity rule',
    reviewIndicators:
      'for ccTLDs (e.g. .tk) check the registry\'s local dispute policy as UDRP does not apply; gTLDs (.xyz, .click, .top) are UDRP-eligible; document registrant\'s portfolio across other low-cost TLDs',
  },
  mixed: {
    name: 'Multi-vector squatting',
    signSimilarity:
      'multiple techniques layered together (combosquatting + keyword injection + suspicious TLD); deliberate compounding to maximize confusion and evade simple detection',
    udrpI:
      'satisfied: the mark is recognizable through the layered modifications',
    udrpII:
      'legitimate interest extremely improbable given the deliberate technique stacking',
    udrpIII:
      'strong bad-faith inference; the technique compounding is itself probative',
    udrpB:
      'multiple ¶ 4(b) limbs may apply: (iv) confusion for gain, (iii) blocking, (ii) pattern',
    eutmr:
      '9(2)(b) clearly engaged; potentially 9(2)(c) if the mark has reputation status (not verified by this tool)',
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
