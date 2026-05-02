import { useEffect, useState } from 'react';

export type SessionMode = 'worker' | 'byok';

type Props = {
  initialKey: string | null;
  workerEnabled: boolean;
  onStart: (config: {
    brand: string;
    mode: SessionMode;
    apiKey?: string;
    threshold: number;
  }) => void;
};

export function SetupScreen({ initialKey, workerEnabled, onStart }: Props) {
  const [brand, setBrand] = useState('');
  const [apiKey, setApiKey] = useState(initialKey ?? '');
  const [threshold, setThreshold] = useState(80);
  const [showKey, setShowKey] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showThresholdInfo, setShowThresholdInfo] = useState(false);

  useEffect(() => {
    if (!showThresholdInfo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowThresholdInfo(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showThresholdInfo]);

  const brandValid = brand.trim().length >= 2 && /^[a-z0-9-]+$/i.test(brand.trim());
  const keyValid = apiKey.trim().startsWith('sk-ant-') && apiKey.trim().length > 20;

  const start = (mode: SessionMode) => {
    setTouched(true);
    if (!brandValid) return;
    if (mode === 'byok' && !keyValid) return;
    onStart({
      brand: brand.trim().toLowerCase(),
      mode,
      apiKey: mode === 'byok' ? apiKey.trim() : undefined,
      threshold,
    });
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    start(workerEnabled ? 'worker' : 'byok');
  };

  const apiKeyField = (
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
          className="w-full bg-bg border border-border rounded-sm px-4 py-3 pr-20 font-mono text-sm focus:outline-none focus:border-accent focus-ring transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-text px-2 py-1 font-mono uppercase tracking-wider rounded-sm focus-ring"
        >
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Stored only in <span className="font-mono text-low">sessionStorage</span>. Calls go
        directly to Anthropic, never via our server.
      </p>
      {touched && !keyValid && (
        <p className="mt-1.5 text-xs text-critical">
          Key must start with <span className="font-mono">sk-ant-</span>.
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT — Form */}
        <div className="bg-surface border border-border rounded-sm p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <Logo />
            <div>
              <h1 className="text-xl font-bold tracking-tight">TM Radar</h1>
              <p className="text-xs text-muted font-mono uppercase tracking-wider">
                Real-Time Brand Protection
              </p>
            </div>
          </div>

          <form onSubmit={submitForm} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Brand name to monitor
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="nike, paypal, spotify..."
                className="w-full bg-bg border border-border rounded-sm px-4 py-3 font-mono text-base focus:outline-none focus:border-accent focus-ring transition-colors"
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

            {!workerEnabled && apiKeyField}

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                    Similarity threshold
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowThresholdInfo((v) => !v)}
                    className="text-muted hover:text-accent transition-colors rounded-sm focus-ring"
                    aria-label="What is similarity threshold?"
                    aria-expanded={showThresholdInfo}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3.5 h-3.5"
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </button>
                </div>
                <span className="font-mono text-base text-accent">{threshold}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-accent rounded-sm focus-ring"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono mt-1">
                <span>permissive (50)</span>
                <span>strict (100)</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Domains scoring ≥ {threshold} trigger automatic AI analysis.
              </p>
            </div>

            {workerEnabled ? (
              <>
                <button
                  type="submit"
                  className="w-full bg-accent hover:bg-blue-600 text-white font-semibold py-3 rounded-sm transition-colors uppercase tracking-wider text-sm focus-ring"
                >
                  Start Analysis
                </button>

                <details className="group border-t border-border pt-4" open={!!initialKey}>
                  <summary className="list-none cursor-pointer text-xs text-muted hover:text-text transition-colors select-none">
                    <span className="inline-block transition-transform group-open:rotate-90 mr-2">
                      ▸
                    </span>
                    Power user: use your own Anthropic API key for unlimited analyses
                  </summary>
                  <div className="mt-4 space-y-4">
                    {apiKeyField}
                    <button
                      type="button"
                      onClick={() => start('byok')}
                      className="w-full border border-accent text-accent hover:bg-accent hover:text-white font-semibold py-3 rounded-sm transition-colors uppercase tracking-wider text-sm focus-ring"
                    >
                      Start with my key →
                    </button>
                  </div>
                </details>
              </>
            ) : (
              <button
                type="submit"
                className="w-full bg-accent hover:bg-blue-600 text-white font-semibold py-3 rounded-sm transition-colors uppercase tracking-wider text-sm focus-ring"
              >
                Start Monitoring →
              </button>
            )}
          </form>
        </div>

        {/* RIGHT — Explainer */}
        <div className="space-y-7 pt-2">
          <ProseSection title="What are Certificate Transparency logs?">
            Every TLS certificate issued by every CA is published to public, append-only logs.
            <span className="font-mono text-text"> crt.sh</span> indexes them all and exposes a
            JSON API. We poll it every 30 seconds for new certificates whose hostnames match
            your brand string.
          </ProseSection>

          <Section title="How this tool works">
            <ol className="space-y-2.5 mt-3">
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
                Claude assesses sign similarity, goods/services indicators, and confusion-risk;
                maps signals to UDRP Paragraph 4(a) and EUTMR Art. 9(2) limbs for attorney
                review.
              </Step>
            </ol>
          </Section>

          <p className="text-[11px] text-muted/90 leading-relaxed flex gap-2 pt-1">
            <span className="text-medium flex-none" aria-hidden>⚠</span>
            <span>
              <span className="text-medium font-semibold">Legal disclaimer.</span>{' '}
              Identifies <em>potential</em> infringements for investigative purposes only;
              does not constitute legal advice. Consult a qualified trademark attorney before
              initiating enforcement action.
            </span>
          </p>
        </div>
      </div>
      {showThresholdInfo && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-bg/60 backdrop-blur-[2px]"
          onClick={() => setShowThresholdInfo(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="threshold-info-title"
        >
          <div
            className="w-full max-w-md bg-surface border border-border rounded-sm shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-3">
              <h3
                id="threshold-info-title"
                className="text-sm font-semibold tracking-tight text-text"
              >
                Similarity threshold
              </h3>
              <button
                onClick={() => setShowThresholdInfo(false)}
                className="text-muted hover:text-text text-xs font-mono uppercase tracking-wider rounded-sm focus-ring px-1"
                aria-label="Close"
              >
                esc
              </button>
            </div>
            <div className="text-sm text-muted leading-relaxed space-y-3">
              <p>
                <span className="text-text font-semibold">Score (0–100)</span>{' '}
                rates how similar a candidate domain is to your brand. Four
                signals contribute:
              </p>
              <ul className="space-y-1.5 pl-4 list-disc marker:text-border">
                <li>
                  <span className="text-text">Levenshtein distance</span> —
                  character-level edit distance to the brand string.
                </li>
                <li>
                  <span className="text-text">Homoglyph normalization</span>{' '}
                  — Cyrillic look-alikes and digit/letter substitutions (
                  <span className="font-mono text-text">0/o</span>,{' '}
                  <span className="font-mono text-text">1/i</span>).
                </li>
                <li>
                  <span className="text-text">Suspicious-keyword affixes</span>{' '}
                  — phishing-typical terms like{' '}
                  <span className="font-mono text-text">login</span>,{' '}
                  <span className="font-mono text-text">secure</span>,{' '}
                  <span className="font-mono text-text">verify</span>.
                </li>
                <li>
                  <span className="text-text">High-risk-TLD weighting</span>{' '}
                  — domains on{' '}
                  <span className="font-mono text-text">.tk</span>,{' '}
                  <span className="font-mono text-text">.top</span>,{' '}
                  <span className="font-mono text-text">.click</span>{' '}
                  (low-cost, high-abuse) get a small penalty.
                </li>
              </ul>
              <p>
                Lower thresholds catch more variants but add noise. Higher
                ones surface only near-identical matches.{' '}
                <span className="text-text">80</span> is balanced for
                well-known brands; drop to{' '}
                <span className="text-text">65–70</span> for niche names
                with few legitimate registrations.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">
        {title}
      </h2>
      <div className="text-sm text-muted leading-relaxed">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-sm p-5 shadow-lg">
      <h2 className="text-sm font-semibold tracking-tight text-text mb-1">{title}</h2>
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
