export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'demo';

export type CertMeta = {
  issuer?: string;
  notBefore?: string;
  notAfter?: string;
};

export type CtSourceHandlers = {
  onDomain: (domain: string, meta: CertMeta) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  brandHint?: string;
  forceDemoMode?: boolean;
};

const POLL_INTERVAL_MS = 30_000;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const FIRST_POLL_BACKLOG_LIMIT = 12;

const WORKER_URL = (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '');

type Fetcher = (brand: string, target: string) => Promise<unknown>;

const FETCHERS: Fetcher[] = [
  ...(WORKER_URL
    ? [
        async (brand: string) => {
          const res = await fetch(
            `${WORKER_URL}/crtsh?q=${encodeURIComponent(brand)}`,
            { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
          );
          if (!res.ok) throw new Error(`worker ${res.status}`);
          return res.json();
        },
      ]
    : []),
  async (_brand: string, target: string) => {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`allorigins ${res.status}`);
    const data = (await res.json()) as { contents?: string };
    return typeof data.contents === 'string' ? JSON.parse(data.contents) : data;
  },
  async (_brand: string, target: string) => {
    const res = await fetch(
      `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(target)}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`codetabs ${res.status}`);
    return JSON.parse(await res.text());
  },
];

type CrtshEntry = {
  id?: number;
  name_value?: string;
  common_name?: string;
  issuer_name?: string;
  not_before?: string;
  not_after?: string;
};

/**
 * Polls crt.sh for certificate transparency entries whose Subject Alternative
 * Names match a brand substring. crt.sh's `id` field is monotonically
 * increasing per insert, so we can implement an "only emit new" cursor by
 * tracking the highest id seen so far.
 */
export class CrtshClient {
  private readonly brand: string;
  private pollTimer: number | null = null;
  private demoTimer: number | null = null;
  private suspiciousTimer: number | null = null;
  private stopped = false;
  private status: ConnectionStatus = 'connecting';
  private highestSeenId = 0;
  private consecutiveFailures = 0;
  private firstPoll = true;

  constructor(private handlers: CtSourceHandlers) {
    this.brand = (handlers.brandHint || '').toLowerCase().trim();
  }

  start() {
    this.stopped = false;
    if (this.handlers.forceDemoMode) {
      this.startDemoMode();
      return;
    }
    if (!this.brand) {
      this.startDemoMode();
      return;
    }
    this.setStatus('connecting');
    void this.poll();
  }

  stop() {
    this.stopped = true;
    if (this.pollTimer !== null) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.demoTimer !== null) {
      window.clearInterval(this.demoTimer);
      this.demoTimer = null;
    }
    if (this.suspiciousTimer !== null) {
      window.clearInterval(this.suspiciousTimer);
      this.suspiciousTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.handlers.onStatusChange(status);
  }

  private async poll() {
    if (this.stopped) return;
    try {
      const entries = await this.fetchEntries();
      this.consecutiveFailures = 0;
      this.setStatus('connected');
      this.processEntries(entries);
    } catch (err) {
      this.consecutiveFailures++;
      console.warn('[crtsh] poll failed', err);
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.startDemoMode();
        return;
      }
      this.setStatus('reconnecting');
    }
    if (!this.stopped) {
      this.pollTimer = window.setTimeout(() => void this.poll(), POLL_INTERVAL_MS);
    }
  }

  private processEntries(entries: CrtshEntry[]) {
    const newEntries = entries
      .filter((e) => typeof e.id === 'number' && e.id > this.highestSeenId)
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    // On the very first poll, emit only a small recent slice — otherwise we
    // dump the entire backlog into the UI as if it just arrived.
    const toEmit = this.firstPoll
      ? newEntries.slice(-FIRST_POLL_BACKLOG_LIMIT)
      : newEntries;

    for (const entry of toEmit) {
      const meta: CertMeta = {
        issuer: shortenIssuer(entry.issuer_name),
        notBefore: entry.not_before,
        notAfter: entry.not_after,
      };
      for (const domain of extractDomains(entry)) {
        this.handlers.onDomain(domain, meta);
      }
    }

    if (newEntries.length > 0) {
      this.highestSeenId = newEntries[newEntries.length - 1].id ?? this.highestSeenId;
    } else if (this.firstPoll && entries.length > 0) {
      // No id-greater entries existed (we have nothing to compare to yet) —
      // anchor the cursor at the maximum id so we don't refetch the same set.
      this.highestSeenId = Math.max(
        ...entries.map((e) => e.id ?? 0),
        this.highestSeenId,
      );
    }
    this.firstPoll = false;
  }

  private async fetchEntries(): Promise<CrtshEntry[]> {
    const target = `https://crt.sh/?q=%25${encodeURIComponent(this.brand)}%25&exclude=expired&dedupe=Y&output=json`;
    let lastErr: unknown = null;
    for (const fetcher of FETCHERS) {
      try {
        const parsed = await fetcher(this.brand, target);
        if (!Array.isArray(parsed)) {
          lastErr = new Error('unexpected response shape');
          continue;
        }
        return parsed as CrtshEntry[];
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    throw lastErr ?? new Error('all proxies failed');
  }

  // ----- Demo mode (identical UX whether triggered by force or fallback) -----

  private startDemoMode() {
    this.setStatus('demo');
    const brand = this.brand || 'brand';
    let counter = 0;

    const emit = (d: string) => this.handlers.onDomain(d, fakeCertMeta());

    this.demoTimer = window.setInterval(() => {
      const batch = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < batch; i++) {
        emit(randomBenignDomain(counter++));
      }
    }, 220);

    this.suspiciousTimer = window.setInterval(() => {
      const variants = suspiciousVariants(brand);
      emit(variants[Math.floor(Math.random() * variants.length)]);
    }, 9000 + Math.random() * 3000);
  }
}

function shortenIssuer(name?: string): string | undefined {
  if (!name) return undefined;
  // crt.sh issuer_name format: "C=US, O=Let's Encrypt, CN=R3"
  // Prefer the Organization (O=) field; fall back to the whole string.
  const m = name.match(/O\s*=\s*"?([^",]+)"?/i);
  return (m?.[1] ?? name).trim();
}

const FAKE_ISSUERS = ["Let's Encrypt", 'Sectigo', 'DigiCert', 'ZeroSSL', 'GoDaddy'];

function fakeCertMeta(): CertMeta {
  const ageDays = Math.floor(Math.random() * 30);
  const lifeDays = 60 + Math.floor(Math.random() * 60);
  return {
    issuer: FAKE_ISSUERS[Math.floor(Math.random() * FAKE_ISSUERS.length)],
    notBefore: new Date(Date.now() - ageDays * 86_400_000).toISOString(),
    notAfter: new Date(Date.now() + (lifeDays - ageDays) * 86_400_000).toISOString(),
  };
}

function extractDomains(entry: CrtshEntry): string[] {
  const out = new Set<string>();
  if (entry.common_name) out.add(normalizeDomain(entry.common_name));
  if (entry.name_value) {
    for (const piece of entry.name_value.split(/[\n,]+/)) {
      const d = normalizeDomain(piece);
      if (d) out.add(d);
    }
  }
  out.delete('');
  return Array.from(out);
}

function normalizeDomain(input: string): string {
  let d = input.toLowerCase().trim();
  if (d.startsWith('*.')) d = d.slice(2);
  return d;
}

const TLDS = ['.com', '.net', '.io', '.de', '.org', '.co', '.dev', '.app', '.shop', '.cloud'];
const ADJ = ['blue', 'fast', 'quiet', 'modern', 'open', 'nimble', 'silver', 'bright', 'urban', 'meta', 'inner', 'vivid'];
const NOUN = ['cloud', 'lab', 'works', 'studio', 'stack', 'forge', 'kit', 'dash', 'pulse', 'hub', 'desk', 'grid', 'core', 'wave'];

function randomBenignDomain(seed: number): string {
  const r = (n: number) => Math.floor(Math.random() * n);
  const a = ADJ[r(ADJ.length)];
  const n = NOUN[r(NOUN.length)];
  const tld = TLDS[r(TLDS.length)];
  const suffix = seed % 7 === 0 ? r(999).toString() : '';
  return `${a}${n}${suffix}${tld}`;
}

function suspiciousVariants(brand: string): string[] {
  const out: string[] = [];
  if (brand.length > 2) {
    out.push(`${brand}${brand[brand.length - 1]}.com`);
    out.push(`${brand.slice(0, -1)}.net`);
  }
  out.push(`${brand}-support.xyz`);
  out.push(`${brand}login.com`);
  out.push(`get-${brand}.top`);
  out.push(`secure-${brand}.click`);
  out.push(`${brand}-official.shop`);
  out.push(`${brand}store.online`);
  if (brand.includes('o')) out.push(brand.replace('o', '0') + '.com');
  if (brand.includes('i')) out.push(brand.replace('i', '1') + '.net');
  if (brand.includes('a')) out.push(brand.replace('a', 'а') + '.com');
  out.push(`${brand}.tk`);
  out.push(`${brand}.ml`);
  return out;
}
