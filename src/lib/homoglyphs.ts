export const homoglyphs: Record<string, string[]> = {
  a: ['а', 'ą', 'à', 'á', 'â', 'ã', 'ä', '@'],
  e: ['е', 'ę', 'è', 'é', 'ê', 'ë', '3'],
  i: ['і', 'ì', 'í', 'î', 'ï', '1', 'l'],
  o: ['о', 'ò', 'ó', 'ô', 'õ', 'ö', '0'],
  u: ['ü', 'ù', 'ú', 'û'],
  n: ['ñ', 'η'],
  c: ['с', 'ç'],
  s: ['ѕ', '$', '5'],
  g: ['q', '9'],
  b: ['6', 'ь'],
  l: ['1', 'i', '|'],
  m: ['rn'],
  p: ['р'],
  k: ['к'],
  t: ['т', '7'],
  y: ['у'],
  x: ['х'],
};

const reverseMap: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [latin, variants] of Object.entries(homoglyphs)) {
    for (const variant of variants) {
      if (!(variant in map)) map[variant] = latin;
    }
  }
  return map;
})();

/** Replace homoglyph variants with their canonical Latin equivalents. */
export function normalizeHomoglyphs(input: string): string {
  let out = '';
  for (const ch of input) {
    out += reverseMap[ch] ?? ch;
  }
  return out;
}

/** Count how many characters in the string are homoglyph substitutions. */
export function countHomoglyphSubstitutions(input: string): number {
  let count = 0;
  for (const ch of input) {
    if (ch in reverseMap) count++;
  }
  return count;
}
