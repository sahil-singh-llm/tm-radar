import type { AnalyzeRequest, Env, Stage } from './types';
import { callAnthropic, estimateCostMicroUsd, type AnthropicResult } from './anthropic';

const BRAND_RE = /^[a-z0-9-]{2,40}$/i;
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const MAX_WEBSITE_CHARS = 8000;
// KV TTL for counters: 36h so the daily key has slack across timezones.
const COUNTER_TTL_SECONDS = 60 * 60 * 36;
const CRTSH_CACHE_TTL_SECONDS = 60;
const CRTSH_FETCH_TIMEOUT_MS = 15000;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return preflight(req, env);

    const url = new URL(req.url);

    if (url.pathname === '/analyze' && req.method === 'POST') {
      return handleAnalyze(req, env, ctx);
    }
    if (url.pathname === '/crtsh' && req.method === 'GET') {
      return handleCrtsh(req, env, ctx, url);
    }
    return json({ error: 'not found' }, 404, req, env);
  },
};

async function handleAnalyze(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!isAllowedOrigin(req, env)) {
    return json({ error: 'origin not allowed' }, 403, req, env);
  }

  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return json({ error: 'invalid JSON' }, 400, req, env);
  }
  const validationError = validateAnalyze(body);
  if (validationError) return json({ error: validationError }, 400, req, env);

  if (env.TURNSTILE_SECRET_KEY) {
    const ok = await verifyTurnstile(
      env.TURNSTILE_SECRET_KEY,
      body.turnstileToken,
      getClientIp(req),
    );
    if (!ok) return json({ error: 'turnstile verification failed' }, 401, req, env);
  }

  const ip = getClientIp(req);
  const rateLimitKey = `ratelimit:${ip}:${dateKey()}`;
  const ipCount = parseInt((await env.KV.get(rateLimitKey)) ?? '0', 10);
  if (ipCount >= parseInt(env.PER_IP_DAILY_LIMIT, 10)) {
    return json(
      { error: 'rate limit exceeded — try BYOK or come back tomorrow' },
      429,
      req,
      env,
    );
  }

  const cacheKey = `cache:${body.stage}:${body.brand.toLowerCase()}:${body.domain.toLowerCase()}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) {
    ctx.waitUntil(incrKv(env, rateLimitKey, 1, COUNTER_TTL_SECONDS));
    return json({ analysis: cached, cached: true, stage: body.stage }, 200, req, env);
  }

  const budgetKey = `budget:${dateKey()}`;
  const spent = parseInt((await env.KV.get(budgetKey)) ?? '0', 10);
  const budgetMicroUsd = parseFloat(env.DAILY_BUDGET_USD) * 1_000_000;
  if (spent >= budgetMicroUsd) {
    return json(
      { error: 'daily budget exhausted — try BYOK or come back tomorrow' },
      429,
      req,
      env,
    );
  }

  const model: string =
    body.stage === 'domain-only' ? env.HAIKU_MODEL : env.SONNET_MODEL;
  const maxTokens = parseInt(env.MAX_TOKENS, 10);

  let result: AnthropicResult;
  try {
    result = await callAnthropic(env.ANTHROPIC_API_KEY, model, maxTokens, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `upstream error: ${msg}` }, 502, req, env);
  }

  const cost = estimateCostMicroUsd(model, result.usage);
  ctx.waitUntil(
    Promise.all([
      incrKv(env, budgetKey, cost, COUNTER_TTL_SECONDS),
      incrKv(env, rateLimitKey, 1, COUNTER_TTL_SECONDS),
      env.KV.put(cacheKey, result.text, {
        expirationTtl: parseInt(env.CACHE_TTL_SECONDS, 10),
      }),
    ]),
  );

  return json(
    { analysis: result.text, cached: false, stage: body.stage },
    200,
    req,
    env,
  );
}

async function handleCrtsh(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
): Promise<Response> {
  if (!isAllowedOrigin(req, env)) {
    return json({ error: 'origin not allowed' }, 403, req, env);
  }
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!BRAND_RE.test(q)) return json({ error: 'invalid q' }, 400, req, env);

  const cacheKey = `crtsh:${q.toLowerCase()}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        ...corsHeaders(req, env),
      },
    });
  }

  const target = `https://crt.sh/?q=%25${encodeURIComponent(q)}%25&exclude=expired&dedupe=Y&output=json`;
  let body: string;
  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(CRTSH_FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return json({ error: `crt.sh ${res.status}` }, 502, req, env);
    body = await res.text();
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed)) return json({ error: 'unexpected shape' }, 502, req, env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `fetch failed: ${msg}` }, 502, req, env);
  }

  ctx.waitUntil(
    env.KV.put(cacheKey, body, { expirationTtl: CRTSH_CACHE_TTL_SECONDS }),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders(req, env),
    },
  });
}

function validateAnalyze(body: AnalyzeRequest): string | null {
  if (!body || typeof body !== 'object') return 'invalid body';
  if (typeof body.brand !== 'string' || !BRAND_RE.test(body.brand)) return 'invalid brand';
  if (
    typeof body.domain !== 'string' ||
    body.domain.length > 253 ||
    !DOMAIN_RE.test(body.domain)
  ) {
    return 'invalid domain';
  }
  if (typeof body.score !== 'number' || body.score < 0 || body.score > 100) {
    return 'invalid score';
  }
  if (!Array.isArray(body.reasons) || body.reasons.length > 20) return 'invalid reasons';
  if (body.reasons.some((r) => typeof r !== 'string' || r.length > 100)) {
    return 'invalid reason entry';
  }
  const stage: Stage = body.stage;
  if (stage !== 'domain-only' && stage !== 'enriched') return 'invalid stage';
  if (body.websiteContent != null) {
    if (typeof body.websiteContent !== 'string') return 'invalid websiteContent';
    if (body.websiteContent.length > MAX_WEBSITE_CHARS) return 'websiteContent too long';
  }
  if (body.brandProfile != null && typeof body.brandProfile !== 'object') {
    return 'invalid brandProfile';
  }
  return null;
}

function isAllowedOrigin(req: Request, env: Env): boolean {
  const origin = req.headers.get('Origin') ?? '';
  if (!origin) return false;
  const allowed = env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function preflight(req: Request, env: Env): Response {
  if (!isAllowedOrigin(req, env)) return new Response(null, { status: 403 });
  const origin = req.headers.get('Origin') ?? '';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  if (!isAllowedOrigin(req, env)) return {};
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

function json(payload: unknown, status: number, req: Request, env: Env): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders(req, env),
    },
  });
}

function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? 'unknown';
}

function dateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// KV is eventually consistent: the counter may briefly under-count under heavy
// concurrency, so the budget cap is approximate. Acceptable for portfolio scale;
// the Anthropic dashboard spending limit is the strict backstop.
async function incrKv(env: Env, key: string, delta: number, ttl: number): Promise<void> {
  const current = parseInt((await env.KV.get(key)) ?? '0', 10);
  await env.KV.put(key, String(current + delta), { expirationTtl: ttl });
}

async function verifyTurnstile(
  secret: string,
  token: string | undefined,
  ip: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    form.append('remoteip', ip);
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: form },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
