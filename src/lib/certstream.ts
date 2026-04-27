export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'demo';

export type CertstreamHandlers = {
  onDomain: (domain: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  brandHint?: string;
};

const CERTSTREAM_URL = 'wss://certstream.calidog.io';
const MAX_RECONNECT_ATTEMPTS = 3;

type CertstreamMessage = {
  message_type?: string;
  data?: {
    leaf_cert?: {
      all_domains?: string[];
      subject?: { CN?: string };
    };
  };
};

export class CertstreamClient {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private demoTimer: number | null = null;
  private suspiciousTimer: number | null = null;
  private stopped = false;
  private status: ConnectionStatus = 'connecting';

  constructor(private handlers: CertstreamHandlers) {}

  start() {
    this.stopped = false;
    this.attempt = 0;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
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

  private connect() {
    if (this.stopped) return;

    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(CERTSTREAM_URL);
    } catch {
      this.handleFailure();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: CertstreamMessage = JSON.parse(event.data as string);
        if (msg.message_type !== 'certificate_update') return;
        const all = msg.data?.leaf_cert?.all_domains ?? [];
        const seen = new Set<string>();
        for (const raw of all) {
          let d = (raw || '').toLowerCase().trim();
          if (!d) continue;
          if (d.startsWith('*.')) d = d.slice(2);
          if (seen.has(d)) continue;
          seen.add(d);
          this.handlers.onDomain(d);
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onerror = () => {
      // The error event fires alongside close; handle there.
    };

    ws.onclose = () => {
      if (this.stopped) return;
      this.handleFailure();
    };
  }

  private handleFailure() {
    if (this.stopped) return;
    this.attempt++;
    if (this.attempt > MAX_RECONNECT_ATTEMPTS) {
      this.startDemoMode();
      return;
    }
    const backoff = Math.min(1000 * 2 ** (this.attempt - 1), 8000);
    this.setStatus('reconnecting');
    window.setTimeout(() => this.connect(), backoff);
  }

  private startDemoMode() {
    this.setStatus('demo');
    const brand = (this.handlers.brandHint || 'brand').toLowerCase();
    let counter = 0;

    const emit = (d: string) => this.handlers.onDomain(d);

    this.demoTimer = window.setInterval(() => {
      const batch = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < batch; i++) {
        emit(randomBenignDomain(counter++));
      }
    }, 220);

    this.suspiciousTimer = window.setInterval(() => {
      const variants = suspiciousVariants(brand);
      const pick = variants[Math.floor(Math.random() * variants.length)];
      emit(pick);
    }, 9000 + Math.random() * 3000);
  }
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
  // Typo
  if (brand.length > 2) {
    out.push(`${brand}${brand[brand.length - 1]}.com`);
    out.push(`${brand.slice(0, -1)}.net`);
  }
  // Combosquatting / keyword
  out.push(`${brand}-support.xyz`);
  out.push(`${brand}login.com`);
  out.push(`get-${brand}.top`);
  out.push(`secure-${brand}.click`);
  out.push(`${brand}-official.shop`);
  out.push(`${brand}store.online`);
  // Homoglyph
  if (brand.includes('o')) out.push(brand.replace('o', '0') + '.com');
  if (brand.includes('i')) out.push(brand.replace('i', '1') + '.net');
  if (brand.includes('a')) out.push(brand.replace('a', 'а') + '.com'); // Cyrillic а
  // TLD switch
  out.push(`${brand}.tk`);
  out.push(`${brand}.ml`);
  return out;
}
