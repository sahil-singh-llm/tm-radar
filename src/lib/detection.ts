import { countHomoglyphSubstitutions, normalizeHomoglyphs } from './homoglyphs';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type DetectionResult = {
  domain: string;
  score: number;
  reasons: string[];
  severity: Severity;
  matchedKeyword?: string;
  technique: 'typosquatting' | 'homoglyph' | 'combosquatting' | 'tld' | 'keyword' | 'mixed';
};

export const SUSPICIOUS_KEYWORDS = [
  'support', 'help', 'login', 'secure', 'verify', 'account',
  'update', 'confirm', 'service', 'official', 'shop', 'store',
  'pay', 'payment', 'bank', 'auth', 'signin', 'customer',
  'portal', 'online', 'access', 'connect', 'get', 'buy',
];

export const SUSPICIOUS_TLDS = [
  '.tk', '.ml', '.ga', '.cf', '.gq',
  '.xyz', '.top', '.click', '.link', '.zip', '.mov',
];

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Strip wildcards and punycode prefixes, then split host from TLD-bearing tail. */
export function parseDomain(domain: string): { label: string; tld: string; full: string } {
  let full = domain.trim().toLowerCase();
  if (full.startsWith('*.')) full = full.slice(2);
  if (full.startsWith('www.')) full = full.slice(4);

  const parts = full.split('.');
  if (parts.length < 2) {
    return { label: full, tld: '', full };
  }
  const tld = '.' + parts.slice(-1)[0];
  const label = parts.slice(0, -1).join('.');
  return { label, tld, full };
}

function severityFromScore(score: number): Severity {
  if (score >= 92) return 'critical';
  if (score >= 80) return 'high';
  if (score >= 65) return 'medium';
  return 'low';
}

function findKeyword(label: string): string | null {
  for (const kw of SUSPICIOUS_KEYWORDS) {
    if (label.includes(kw)) return kw;
  }
  return null;
}

/**
 * Analyze a domain against a brand name. Returns null if score is below the
 * minimum threshold (50) — not noteworthy.
 */
export function analyzeDomain(
  rawDomain: string,
  brand: string,
  minScore = 50,
): DetectionResult | null {
  if (!brand) return null;
  const brandLower = brand.toLowerCase().trim();
  if (!brandLower) return null;

  const { label, tld, full } = parseDomain(rawDomain);
  if (!label || label === brandLower) return null;

  const reasons: string[] = [];
  let score = 0;
  let technique: DetectionResult['technique'] = 'typosquatting';
  let matchedKeyword: string | undefined;

  const labelHead = label.split('.').pop() ?? label;

  // ---- 3a. Levenshtein on the leftmost label component ----
  const dist = levenshtein(labelHead, brandLower);
  const lengthRef = Math.max(brandLower.length, labelHead.length);
  const levScore = Math.max(0, (1 - dist / lengthRef) * 100);
  if (dist > 0 && dist <= 3 && levScore >= 60 && labelHead !== brandLower) {
    score = Math.max(score, levScore);
    reasons.push(`Typosquatting (Levenshtein distance ${dist})`);
    technique = 'typosquatting';
  }

  // ---- 3c. Homoglyph detection ----
  const normalizedLabel = normalizeHomoglyphs(labelHead);
  const subs = countHomoglyphSubstitutions(labelHead);
  if (subs > 0 && normalizedLabel === brandLower) {
    const homoScore = 90 + Math.min(8, subs * 3);
    score = Math.max(score, homoScore);
    reasons.push(`Homoglyph attack (${subs} substituted character${subs === 1 ? '' : 's'})`);
    technique = 'homoglyph';
  } else if (subs > 0 && normalizedLabel.includes(brandLower)) {
    score = Math.max(score, 80);
    reasons.push(`Homoglyph + brand inclusion`);
    technique = 'homoglyph';
  }

  // ---- 3e. Combosquatting (brand as substring with extras) ----
  const containsBrand = label.includes(brandLower) && labelHead !== brandLower;
  if (containsBrand) {
    const extra = label.length - brandLower.length;
    const comboScore = Math.max(70, 100 - Math.min(extra, 20) * 1.2);
    if (comboScore > score) {
      score = comboScore;
      technique = 'combosquatting';
    }
    reasons.push('Combosquatting (brand as substring)');
  }

  // ---- 3b. Brand + suspicious keyword ----
  if (containsBrand || normalizedLabel.includes(brandLower)) {
    const kw = findKeyword(label);
    if (kw) {
      matchedKeyword = kw;
      score = Math.max(score, 95);
      reasons.push(`Suspicious keyword: "${kw}"`);
      technique = technique === 'typosquatting' ? 'keyword' : 'mixed';
    }
  }

  // ---- 3d. Suspicious TLD bonus ----
  if (tld && SUSPICIOUS_TLDS.includes(tld) && (containsBrand || levScore >= 70 || subs > 0)) {
    score = Math.min(100, score + 20);
    reasons.push(`Suspicious TLD: ${tld}`);
    if (technique === 'typosquatting') technique = 'tld';
    else technique = 'mixed';
  }

  if (reasons.length === 0 || score < minScore) return null;

  // De-duplicate reasons while preserving order.
  const dedup: string[] = [];
  for (const r of reasons) if (!dedup.includes(r)) dedup.push(r);

  const finalScore = Math.round(Math.min(100, score));
  return {
    domain: full,
    score: finalScore,
    reasons: dedup,
    severity: severityFromScore(finalScore),
    matchedKeyword,
    technique,
  };
}
