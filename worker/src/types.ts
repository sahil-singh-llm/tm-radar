export type Stage = 'domain-only' | 'enriched';

export type BrandProfile = {
  label: string;
  description?: string | null;
  industry?: string | null;
  inception?: string | null;
  country?: string | null;
};

export type AnalyzeRequest = {
  brand: string;
  domain: string;
  score: number;
  reasons: string[];
  stage: Stage;
  websiteContent?: string | null;
  brandProfile?: BrandProfile | null;
  turnstileToken?: string;
};

export type AnalyzeSuccess = {
  analysis: string;
  cached: boolean;
  stage: Stage;
};

export type AnalyzeError = { error: string };

export type Env = {
  KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
  TURNSTILE_SECRET_KEY?: string;
  ALLOWED_ORIGINS: string;
  DAILY_BUDGET_USD: string;
  PER_IP_DAILY_LIMIT: string;
  CACHE_TTL_SECONDS: string;
  SONNET_MODEL: string;
  HAIKU_MODEL: string;
  MAX_TOKENS: string;
};
