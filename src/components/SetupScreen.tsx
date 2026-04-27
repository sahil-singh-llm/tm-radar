import { useState } from 'react';

type Props = {
  initialKey: string | null;
  onStart: (config: { brand: string; apiKey: string; threshold: number; demoMode?: boolean }) => void;
};

export function SetupScreen({ initialKey, onStart }: Props) {
  const [brand, setBrand] = useState('');
  const [apiKey, setApiKey] = useState(initialKey ?? '');
  const [threshold, setThreshold] = useState(80);
  const [showKey, setShowKey] = useState(false);
  const [touched, setTouched] = useState(false);

  const brandValid = brand.trim().length >= 2 && /^[a-z0-9-]+$/i.test(brand.trim());
  const keyValid = apiKey.trim().startsWith('sk-ant-') && apiKey.trim().length > 20;
  const canStart = brandValid && keyValid;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canStart) return;
    onStart({
      brand: brand.trim().toLowerCase(),
      apiKey: apiKey.trim(),
      threshold,
    });
  };

  const startDemo = () => {
    onStart({
      brand: brand.trim().toLowerCase() || 'nike',
      apiKey: '',
      threshold,
      demoMode: true,
    });
  };

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT — Form */}
        <div className="bg-surface border border-border rounded-sm p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <Logo />
            <div>
              <h1 className="text-xl font-bold tracking-tight">TM Radar</h1>
              <p className="text-xs text-muted font-mono uppercase tracking-widest">
                Real-Time Brand Protection
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Brand name to monitor
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="nike, paypal, spotify..."
                className="w-full bg-bg border border-border rounded-sm px-4 py-3 font-mono text-base focus:outline-none focus:border-accent transition-colors"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted">
                Letters, digits, hyphens. Case-insensitive.
              </p>
              {touched && !brandValid && (
                <p className="mt-1.5 text-xs text-critical">
                  Enter a brand name (≥2 characters, alphanumeric).
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Anthropic API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-bg border border-border rounded-sm px-4 py-3 pr-20 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-text px-2 py-1 font-mono uppercase tracking-wider"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Stored only in <span className="font-mono text-low">sessionStorage</span>, never
                transmitted to our servers.
              </p>
              {touched && !keyValid && (
                <p className="mt-1.5 text-xs text-critical">
                  Key must start with <span className="font-mono">sk-ant-</span>.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Similarity threshold
                </label>
                <span className="font-mono text-base text-accent">{threshold}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono mt-1">
                <span>permissive (50)</span>
                <span>strict (100)</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Domains scoring ≥ {threshold} trigger automatic AI analysis.
              </p>
            </div>

            <button
              type="submit"
              disabled={!canStart}
              className="w-full bg-accent hover:bg-blue-600 disabled:bg-border disabled:text-muted disabled:cursor-not-allowed text-white font-semibold py-3 rounded-sm transition-colors uppercase tracking-wider text-sm"
            >
              Start Monitoring →
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-surface text-[10px] font-mono uppercase tracking-widest text-muted">
                  or
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={startDemo}
              className="w-full border border-border hover:border-accent text-muted hover:text-accent font-mono text-xs uppercase tracking-wider py-3 rounded-sm transition-colors"
            >
              ▶ Try demo (no API key required)
            </button>
            <p className="-mt-3 text-[11px] text-muted text-center italic">
              Simulated certificate stream + canned legal analyses for demonstration purposes.
            </p>
          </form>
        </div>

        {/* RIGHT — Explainer */}
        <div className="space-y-5">
          <Section title="What is trademark squatting?">
            Bad actors register domains nearly identical to established brands —{' '}
            <span className="font-mono text-text">nikee.com</span>,{' '}
            <span className="font-mono text-text">paypaI.com</span> (capital i),{' '}
            <span className="font-mono text-text">spotify-support.xyz</span> — to phish customers,
            sell counterfeits, or extort the brand owner. Catching them early is the difference
            between a takedown and a lawsuit.
          </Section>

          <Section title="What are Certificate Transparency logs?">
            Every TLS certificate issued by every CA is published to public, append-only logs.
            <span className="font-mono text-text"> Certstream</span> mirrors that firehose over
            WebSocket — every new HTTPS-capable domain on the public internet, in real time, free.
          </Section>

          <Section title="How this tool works">
            <ol className="space-y-2 mt-2">
              <Step n={1} title="Detect">
                Stream every new certificate; score each domain against your brand using
                Levenshtein distance, homoglyph normalization, keyword injection, and suspicious-TLD
                heuristics.
              </Step>
              <Step n={2} title="Fetch">
                For domains above threshold, retrieve the website content via CORS proxy to enrich
                the analysis with goods & services data.
              </Step>
              <Step n={3} title="Analyze">
                Claude assesses sign similarity, goods similarity, likelihood of confusion, and
                recommends an action under UDRP / EUTMR Art. 9.
              </Step>
            </ol>
          </Section>

          <div className="bg-surface border border-border rounded-sm p-4 text-xs text-muted leading-relaxed">
            <span className="text-medium font-semibold">⚠ Legal disclaimer.</span>{' '}
            This tool identifies <em>potential</em> infringements for investigative purposes only.
            It does not constitute legal advice. Always consult a qualified trademark attorney
            before initiating any enforcement action.
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-sm p-5">
      <h2 className="text-sm font-semibold tracking-wide text-text mb-2 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent inline-block" />
        {title}
      </h2>
      <div className="text-sm text-muted leading-relaxed">{children}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-none w-6 h-6 bg-accent/20 text-accent border border-accent/40 rounded-sm flex items-center justify-center font-mono text-xs font-bold">
        {n}
      </span>
      <div>
        <div className="text-text font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

function Logo() {
  return (
    <div className="w-10 h-10 border border-accent/50 bg-accent/10 flex items-center justify-center rounded-sm">
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
        <line x1="12" y1="22" x2="12" y2="15.5" />
        <polyline points="22 8.5 12 15.5 2 8.5" />
        <line x1="2" y1="15.5" x2="12" y2="8.5" />
        <line x1="12" y1="8.5" x2="22" y2="15.5" />
      </svg>
    </div>
  );
}
