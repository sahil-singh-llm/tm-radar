export type BrandProfile = {
  wikidataId: string;
  label: string;
  description: string | null;
  industry: string | null;
  inception: number | null;
  country: string | null;
  wikipediaUrl: string | null;
};

const cache = new Map<string, BrandProfile | null>();

// Wikidata classes used to gate "actually a real business entity":
// Q4830453 business · Q167270 brand · Q43229 organization · Q891723 public company
// Q6881511 enterprise · Q786820 commercial enterprise
const SPARQL = (ids: string[]) => `SELECT ?item ?itemLabel ?desc ?industryLabel ?inception ?countryLabel ?article WHERE {
  VALUES ?item { ${ids.map((id) => `wd:${id}`).join(' ')} }
  ?item wdt:P31/wdt:P279* ?type .
  VALUES ?type { wd:Q4830453 wd:Q167270 wd:Q43229 wd:Q891723 wd:Q6881511 wd:Q786820 }
  OPTIONAL { ?item schema:description ?desc . FILTER(lang(?desc) = "en") }
  OPTIONAL { ?item wdt:P452 ?industry }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item wdt:P17 ?country }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}`;

type SearchResponse = {
  search?: Array<{ id: string; label?: string }>;
};

type SparqlBinding = {
  item?: { value: string };
  itemLabel?: { value: string };
  desc?: { value: string };
  industryLabel?: { value: string };
  inception?: { value: string };
  countryLabel?: { value: string };
  article?: { value: string };
};

type SparqlResponse = {
  results?: { bindings?: SparqlBinding[] };
};

export async function lookupBrandProfile(brand: string): Promise<BrandProfile | null> {
  const key = brand.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const signal = AbortSignal.timeout(8000);

  try {
    const searchUrl =
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brand)}&language=en&format=json&type=item&limit=5&origin=*`;
    const searchRes = await fetch(searchUrl, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!searchRes.ok) {
      cache.set(key, null);
      return null;
    }
    const searchData = (await searchRes.json()) as SearchResponse;
    const ids = (searchData.search ?? []).map((s) => s.id).filter(Boolean);
    if (ids.length === 0) {
      cache.set(key, null);
      return null;
    }

    const sparqlUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(SPARQL(ids))}`;
    const sparqlRes = await fetch(sparqlUrl, {
      signal,
      headers: { Accept: 'application/sparql-results+json' },
    });
    if (!sparqlRes.ok) {
      cache.set(key, null);
      return null;
    }
    const sparqlData = (await sparqlRes.json()) as SparqlResponse;
    const bindings = sparqlData.results?.bindings ?? [];

    const byId = new Map<string, SparqlBinding>();
    for (const b of bindings) {
      const uri = b.item?.value ?? '';
      const id = uri.split('/').pop() ?? '';
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, b);
    }

    for (const id of ids) {
      const b = byId.get(id);
      if (!b) continue;
      const industry = b.industryLabel?.value ?? null;
      const inceptionRaw = b.inception?.value ?? null;
      const country = b.countryLabel?.value ?? null;
      if (!industry && !inceptionRaw && !country) continue;

      const inception = inceptionRaw ? parseYear(inceptionRaw) : null;
      const profile: BrandProfile = {
        wikidataId: id,
        label: b.itemLabel?.value ?? id,
        description: b.desc?.value ?? null,
        industry,
        inception,
        country,
        wikipediaUrl: b.article?.value ?? null,
      };
      cache.set(key, profile);
      return profile;
    }

    cache.set(key, null);
    return null;
  } catch {
    cache.set(key, null);
    return null;
  }
}

function parseYear(xsdDateTime: string): number | null {
  const m = xsdDateTime.match(/(-?\d{1,4})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return Number.isFinite(y) ? y : null;
}
