import { useEffect, useMemo, useRef, useState } from 'react';
import { CrtshClient, type ConnectionStatus, type CertMeta } from '../lib/crtsh';
import { analyzeDomain, type DetectionResult } from '../lib/detection';
import { fetchWebsiteContent } from '../lib/fetcher';
import { fetchScreenshotUrl } from '../lib/screenshot';
import { analyzeWithClaude, analyzeViaWorker } from '../lib/claude';
import { lookupBrandProfile, type BrandProfile } from '../lib/brandProfile';
import { generateDemoAnalysis } from '../lib/demoAnalysis';
import type { SessionMode } from './SetupScreen';
import { StatsBar } from './StatsBar';
import { Radar, type FeedEntry } from './Radar';
import { DomainAlert, type AlertEntry } from './DomainAlert';

type Props = {
  brand: string;
  mode: SessionMode;
  apiKey: string;
  threshold: number;
  onStop: () => void;
};

const FEED_MAX = 24;
const ALERT_MAX = 60;
const FLUSH_MS = 100;

export function Monitor({ brand, mode, apiKey, threshold, onStop }: Props) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [seen, setSeen] = useState(0);
  const [perMinute, setPerMinute] = useState(0);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const startedAt = useRef(Date.now()).current;

  const brandProfileRef = useRef<BrandProfile | null>(null);
  brandProfileRef.current = brandProfile;

  // Buffers for batched UI updates
  const feedBuf = useRef<FeedEntry[]>([]);
  const seenBuf = useRef(0);
  const tickWindow = useRef<number[]>([]);
  const flushTimer = useRef<number | null>(null);

  // Track which domains are currently being analyzed to avoid duplicates.
  const analyzing = useRef<Set<string>>(new Set());
  const alertsRef = useRef<AlertEntry[]>([]);
  alertsRef.current = alerts;

  // Update an alert immutably.
  const updateAlert = (domain: string, patch: Partial<AlertEntry>) => {
    setAlerts((prev) =>
      prev.map((a) => (a.result.domain === domain ? { ...a, ...patch } : a)),
    );
  };

  const runStage = async (
    result: DetectionResult,
    content: string | null,
    profile: BrandProfile | null,
  ): Promise<string> => {
    if (mode === 'worker') {
      try {
        return await analyzeViaWorker(brand, result, content, profile);
      } catch {
        // Worker unreachable, budget exhausted, or rate-limited → silent fallback
        // to canned analysis so the user still sees a memo.
        return generateDemoAnalysis(brand, result, !!content);
      }
    }
    return analyzeWithClaude(apiKey, brand, result, content, profile);
  };

  const runAnalysis = async (result: DetectionResult) => {
    if (analyzing.current.has(result.domain)) return;
    analyzing.current.add(result.domain);

    updateAlert(result.domain, { analysisStage: 'pending', error: undefined });

    try {
      const profile = brandProfileRef.current;

      const stage1 = await runStage(result, null, profile);
      updateAlert(result.domain, {
        analysis: stage1,
        analysisStage: 'domain-only',
      });

      const content = await fetchWebsiteContent(result.domain);
      if (!content) {
        updateAlert(result.domain, {
          websiteUnreachable: true,
          analysisStage: 'domain-only',
        });
        return;
      }

      const stage2 = await runStage(result, content, profile);
      updateAlert(result.domain, {
        analysis: stage2,
        analysisStage: 'enriched',
        websiteFetched: true,
      });
    } catch (e) {
      updateAlert(result.domain, {
        analysisStage: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      analyzing.current.delete(result.domain);
    }
  };

  const requestAnalysis = (domain: string) => {
    const entry = alertsRef.current.find((a) => a.result.domain === domain);
    if (!entry) return;
    runAnalysis(entry.result);
  };

  const runScreenshot = async (domain: string) => {
    try {
      const url = await fetchScreenshotUrl(domain);
      updateAlert(domain, { screenshotUrl: url, screenshotPending: false });
    } catch {
      updateAlert(domain, { screenshotPending: false });
    }
  };

  useEffect(() => {
    let cancelled = false;
    setBrandProfile(null);
    lookupBrandProfile(brand).then((p) => {
      if (!cancelled) setBrandProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [brand]);

  useEffect(() => {
    const flush = () => {
      flushTimer.current = null;
      if (feedBuf.current.length > 0) {
        setFeed((prev) => {
          const merged = [...feedBuf.current, ...prev];
          feedBuf.current = [];
          return merged.slice(0, FEED_MAX);
        });
      }
      if (seenBuf.current > 0) {
        const delta = seenBuf.current;
        seenBuf.current = 0;
        setSeen((s) => s + delta);
        const now = Date.now();
        for (let i = 0; i < delta; i++) tickWindow.current.push(now);
      }
      // Trim tick window to last 60s and update perMinute.
      const cutoff = Date.now() - 60_000;
      while (tickWindow.current.length && tickWindow.current[0] < cutoff) {
        tickWindow.current.shift();
      }
      setPerMinute(tickWindow.current.length);
    };

    const scheduleFlush = () => {
      if (flushTimer.current !== null) return;
      flushTimer.current = window.setTimeout(flush, FLUSH_MS);
    };

    const onDomain = (domain: string, meta: CertMeta) => {
      seenBuf.current++;

      // Detection (synchronous, fast)
      const result = analyzeDomain(domain, brand, 50);

      const entry: FeedEntry = { domain, flagged: !!result, ts: Date.now() + Math.random() };
      feedBuf.current.unshift(entry);
      if (feedBuf.current.length > FEED_MAX) feedBuf.current.length = FEED_MAX;

      if (result) {
        // De-duplicate against existing alerts.
        if (alertsRef.current.some((a) => a.result.domain === result.domain)) {
          scheduleFlush();
          return;
        }

        const willCapture = result.score >= threshold;
        const newAlert: AlertEntry = {
          result,
          certMeta: meta,
          createdAt: Date.now(),
          analysis: null,
          analysisStage: result.score >= threshold ? 'pending' : 'idle',
          websiteFetched: false,
          websiteUnreachable: false,
          screenshotUrl: null,
          screenshotPending: willCapture,
        };

        setAlerts((prev) => {
          // Keep highest-severity at top by createdAt; cap list size.
          const next = [newAlert, ...prev].slice(0, ALERT_MAX);
          return next;
        });

        if (result.score >= threshold) {
          // Kick off analysis async; don't block the stream.
          window.setTimeout(() => runAnalysis(result), 0);
        }
        if (willCapture) {
          window.setTimeout(() => runScreenshot(result.domain), 0);
        }
      }

      scheduleFlush();
    };

    const forceDemoMode =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('demo');

    const client = new CrtshClient({
      onDomain,
      onStatusChange: setStatus,
      brandHint: brand,
      forceDemoMode,
    });
    client.start();

    return () => {
      client.stop();
      if (flushTimer.current !== null) {
        window.clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, apiKey, threshold, mode]);

  const counts = useMemo(() => {
    let c = 0, h = 0, m = 0;
    for (const a of alerts) {
      if (a.result.severity === 'critical') c++;
      else if (a.result.severity === 'high') h++;
      else if (a.result.severity === 'medium') m++;
    }
    return { critical: c, high: h, medium: m };
  }, [alerts]);

  const visibleAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter((a) => a.result.severity === filter);
  }, [alerts, filter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
          e.preventDefault();
          return;
        }
        if (target && target.blur) target.blur();
        return;
      }
      if (inEditable) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setHelpOpen((v) => !v);
        e.preventDefault();
      } else if (e.key === '1') {
        setFilter('all');
      } else if (e.key === '2') {
        setFilter('critical');
      } else if (e.key === '3') {
        setFilter('high');
      } else if (e.key === '4') {
        setFilter('medium');
      } else if (e.key === 's' || e.key === 'S') {
        onStop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen, onStop]);

  return (
    <div className="h-screen flex flex-col bg-bg text-text">
      <StatsBar
        brand={brand}
        status={status}
        seen={seen}
        flagged={alerts.length}
        critical={counts.critical}
        high={counts.high}
        medium={counts.medium}
        perMinute={perMinute}
        startedAt={startedAt}
        onStop={onStop}
        brandProfile={brandProfile}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] overflow-hidden">
        {/* ALERTS COLUMN */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-surface/40">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
              <span className="w-1 h-3 bg-critical inline-block" />
              Alerts
              <span className="text-text font-mono ml-1">{alerts.length}</span>
            </h2>
            <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider">
              {(['all', 'critical', 'high', 'medium'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 border rounded-sm transition-colors focus-ring ${
                    filter === f
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-border text-muted hover:text-text'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {visibleAlerts.length === 0 ? (
              <EmptyState filter={filter} brand={brand} />
            ) : (
              visibleAlerts.map((a) => (
                <DomainAlert
                  key={a.result.domain}
                  entry={a}
                  brand={brand}
                  onRequestAnalysis={requestAnalysis}
                />
              ))
            )}
          </div>
        </div>

        {/* RADAR COLUMN */}
        <Radar entries={feed} alerts={alerts} brand={brand} />
      </div>

      <HelpHint onOpen={() => setHelpOpen(true)} />
      {helpOpen && <KeyboardHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function HelpHint({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      title="Keyboard shortcuts (?)"
      className="fixed bottom-4 right-4 z-30 w-7 h-7 flex items-center justify-center rounded-full border border-border bg-surface/90 text-muted hover:text-accent hover:border-accent text-xs font-mono backdrop-blur-sm focus-ring transition-colors"
      aria-label="Show keyboard shortcuts"
    >
      ?
    </button>
  );
}

function KeyboardHelp({ onClose }: { onClose: () => void }) {
  const rows: Array<[string, string]> = [
    ['?', 'Toggle this help'],
    ['1', 'Show all alerts'],
    ['2', 'Filter critical'],
    ['3', 'Filter high'],
    ['4', 'Filter medium'],
    ['S', 'Stop monitoring'],
    ['Esc', 'Close / blur input'],
  ];
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-end p-4 sm:items-center sm:justify-center bg-bg/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-xs bg-surface border border-border rounded-sm shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted">
            Keyboard
          </h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-xs font-mono uppercase tracking-wider rounded-sm focus-ring px-1"
            aria-label="Close help"
          >
            esc
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          {rows.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between gap-4">
              <dt className="text-text">{label}</dt>
              <dd>
                <kbd className="font-mono text-[11px] px-2 py-0.5 rounded-sm border border-border bg-bg text-accent min-w-[1.75rem] inline-block text-center">
                  {k}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function EmptyState({ filter, brand }: { filter: string; brand: string }) {
  return (
    <div className="border border-dashed border-border rounded-sm p-12 text-center">
      <div className="text-muted font-mono text-xs uppercase tracking-wider mb-3">
        {filter === 'all' ? 'Awaiting Detections' : `No ${filter} alerts yet`}
      </div>
      <p className="text-sm text-muted">
        Streaming Certificate Transparency logs and matching against{' '}
        <span className="font-mono text-accent">"{brand}"</span>.
        <br />
        Suspicious domains will appear here as they are issued.
      </p>
    </div>
  );
}
