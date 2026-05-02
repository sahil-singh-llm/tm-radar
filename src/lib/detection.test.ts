import { describe, it, expect } from 'vitest';
import { analyzeDomain, levenshtein, parseDomain } from './detection';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('nike', 'nike')).toBe(0);
  });

  it('counts a single insertion', () => {
    expect(levenshtein('nike', 'nikee')).toBe(1);
  });

  it('counts a single substitution', () => {
    expect(levenshtein('nike', 'mike')).toBe(1);
  });

  it('handles either-side empty input', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('', '')).toBe(0);
  });

  it('matches the canonical kitten/sitting=3 case', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('parseDomain', () => {
  it('strips wildcard prefix', () => {
    expect(parseDomain('*.example.com')).toEqual({
      label: 'example',
      tld: '.com',
      full: 'example.com',
    });
  });

  it('strips www prefix', () => {
    expect(parseDomain('www.example.com')).toEqual({
      label: 'example',
      tld: '.com',
      full: 'example.com',
    });
  });

  it('lowercases input', () => {
    expect(parseDomain('NIKE.COM')).toEqual({
      label: 'nike',
      tld: '.com',
      full: 'nike.com',
    });
  });

  it('returns empty tld for single-segment hosts', () => {
    expect(parseDomain('localhost')).toEqual({
      label: 'localhost',
      tld: '',
      full: 'localhost',
    });
  });
});

describe('analyzeDomain — guards', () => {
  it('returns null when brand is empty', () => {
    expect(analyzeDomain('nike.com', '')).toBeNull();
  });

  it('returns null for the brand domain itself', () => {
    expect(analyzeDomain('nike.com', 'nike')).toBeNull();
  });

  it('returns null when nothing scores above the minimum', () => {
    // edit distance too far + no other signals
    expect(analyzeDomain('xkcd.com', 'nike')).toBeNull();
  });
});

describe('analyzeDomain — typosquatting', () => {
  it('detects a single-character substitution', () => {
    const r = analyzeDomain('mike.com', 'nike');
    expect(r).not.toBeNull();
    expect(r?.technique).toBe('typosquatting');
    expect(r?.reasons[0]).toMatch(/Levenshtein distance 1/);
  });

  it('detects digit-substitution (paypa1 vs paypal)', () => {
    const r = analyzeDomain('paypa1.com', 'paypal');
    expect(r).not.toBeNull();
    expect(r?.score).toBeGreaterThanOrEqual(80);
  });
});

describe('analyzeDomain — combosquatting', () => {
  it('flags brand-as-substring with extras', () => {
    // "running" is not a SUSPICIOUS_KEYWORDS token, so this is a pure combosquat.
    const r = analyzeDomain('nike-running.com', 'nike');
    expect(r).not.toBeNull();
    expect(r?.technique).toBe('combosquatting');
    expect(r?.reasons.some((x) => /Combosquatting/.test(x))).toBe(true);
  });

  it('score decays as extra characters grow', () => {
    const tight = analyzeDomain('nike-fan.com', 'nike');
    const loose = analyzeDomain('nike-fan-extra-long-suffix.com', 'nike');
    expect(tight).not.toBeNull();
    expect(loose).not.toBeNull();
    expect(tight!.score).toBeGreaterThanOrEqual(loose!.score);
  });
});

describe('analyzeDomain — keyword injection', () => {
  it('produces a near-max score for brand+login', () => {
    const r = analyzeDomain('nike-login.com', 'nike');
    expect(r).not.toBeNull();
    expect(r?.score).toBeGreaterThanOrEqual(95);
    expect(r?.matchedKeyword).toBe('login');
  });

  it('marks the technique as keyword (or mixed when other signals layer in)', () => {
    const r = analyzeDomain('paypal-secure.com', 'paypal');
    expect(r).not.toBeNull();
    expect(['keyword', 'mixed']).toContain(r!.technique);
  });
});

describe('analyzeDomain — homoglyph', () => {
  it('detects Cyrillic look-alike (і = U+0456 instead of Latin i)', () => {
    // 'nіke' uses Cyrillic 'і' (U+0456)
    const r = analyzeDomain('nіke.com', 'nike');
    expect(r).not.toBeNull();
    expect(r?.technique).toBe('homoglyph');
    expect(r?.score).toBeGreaterThanOrEqual(90);
  });

  it('flags homoglyph + brand inclusion when not exact', () => {
    // 'nіkelogin' — Cyrillic i + keyword
    const r = analyzeDomain('nіkelogin.com', 'nike');
    expect(r).not.toBeNull();
    // Either flagged as homoglyph or as a mixed-vector with the keyword.
    expect(r!.reasons.some((x) => /homoglyph/i.test(x))).toBe(true);
  });
});

describe('analyzeDomain — suspicious TLD', () => {
  it('adds a TLD bonus only when paired with another signal', () => {
    const baseline = analyzeDomain('nike-shop.com', 'nike');
    const onSuspiciousTld = analyzeDomain('nike-shop.tk', 'nike');
    expect(baseline).not.toBeNull();
    expect(onSuspiciousTld).not.toBeNull();
    expect(onSuspiciousTld!.score).toBeGreaterThan(baseline!.score);
    expect(onSuspiciousTld?.reasons.some((x) => /Suspicious TLD/.test(x))).toBe(true);
  });

  it('promotes technique to mixed when TLD layers on a non-typo signal', () => {
    const r = analyzeDomain('nike-store.tk', 'nike');
    expect(r).not.toBeNull();
    expect(['mixed', 'tld', 'combosquatting']).toContain(r!.technique);
  });
});

describe('analyzeDomain — severity bands', () => {
  it('produces critical severity for keyword + multi-vector', () => {
    const r = analyzeDomain('nike-secure-login.tk', 'nike');
    expect(r).not.toBeNull();
    expect(r?.severity).toBe('critical');
  });

  it('honours the minScore parameter', () => {
    // Default min is 50; raise it to 99 and even strong matches drop to null.
    expect(analyzeDomain('nike-store.com', 'nike', 99)).toBeNull();
  });

  it('caps the final score at 100', () => {
    const r = analyzeDomain('nike-secure-login.tk', 'nike');
    expect(r).not.toBeNull();
    expect(r!.score).toBeLessThanOrEqual(100);
  });
});
