import { useEffect, useMemo, useRef, useState } from 'react';
import { CrtshClient, type ConnectionStatus } from '../lib/crtsh';
import { analyzeDomain, type DetectionResult } from '../lib/detection';
import { fetchWebsiteContent } from '../lib/fetcher';
import { fetchScreenshotUrl } from '../lib/screenshot';
import { analyzeWithClaude } from '../lib/claude';
import { generateDemoAnalysis } from '../lib/demoAnalysis';
import { StatsBar } from './StatsBar';
import { LiveFeed, type FeedEntry } from './LiveFeed';
import { DomainAlert, type AlertEntry } from './DomainAlert';

type Props = {
  brand: string;
  apiKey: string;
  threshold: number;
  demoMode: boolean;
  onStop: () => void;
};

const FEED_MAX = 24;
const ALERT_MAX = 60;
const FLUSH_MS = 100;

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export function Monitor({ brand, apiKey, threshold, demoMode, onStop }: Props) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [seen, setSeen] = useState(0);
  const [perMinute, setPerMinute] = useState(0);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');

  const startedAt = useRef(Date.now()).current;

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

  const runAnalysis = async (result: DetectionResult) => {
    if (analyzing.current.has(result.domain)) return;
    analyzing.current.add(result.domain);

    updateAlert(result.domain, { analysisStage: 'pending', error: undefined });

    try {
      if (demoMode) {
        await runDemoAnalysis(result);
        return;
      }

      // Stage 1 — domain-only analysis
      const stage1 = await analyzeWithClaude(apiKey, brand, result, null);
      updateAlert(result.domain, {
        analysis: stage1,
        analysisStage: 'domain-only',
      });

      // Stage 2 — fetch website + enriched analysis
      const content = await fetchWebsiteContent(result.domain);
      if (!content) {
        updateAlert(result.domain, {
          websiteUnreachable: true,
          // Keep stage at domain-only — there's nothing to enrich.
          analysisStage: 'domain-only',
        });
        return;
      }

      const stage2 = await analyzeWithClaude(apiKey, brand, result, content);
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

  const runDemoAnalysis = async (result: DetectionResult) => {
    // Stage 1 — fake latency, then domain-only canned analysis
    await sleep(700 + Math.random() * 800);
    updateAlert(result.domain, {
      analysis: generateDemoAnalysis(brand, result, false),
      analysisStage: 'domain-only',
    });

    // Stage 2 — fake fetch + 20% chance of unreachable for variety
    await sleep(1400 + Math.random() * 1400);
    if (Math.random() < 0.2) {
      updateAlert(result.domain, { websiteUnreachable: true, analysisStage: 'domain-only' });
      return;
    }
    updateAlert(result.domain, {
      analysis: generateDemoAnalysis(brand, result, true),
      analysisStage: 'enriched',
      websiteFetched: true,
    });
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

    const onDomain = (domain: string) => {
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

        const willCapture = !demoMode && result.score >= threshold;
        const newAlert: AlertEntry = {
          result,
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

    const client = new CrtshClient({
      onDomain,
      onStatusChange: setStatus,
      brandHint: brand,
      forceDemoMode: demoMode,
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
  }, [brand, apiKey, threshold, demoMode]);

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

  return (
    <div className="h-screen flex flex-col bg-bg text-text">
      {demoMode && <DemoBanner />}
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
                  className={`px-2 py-1 border rounded-sm transition-colors ${
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
                  onRequestAnalysis={requestAnalysis}
                />
              ))
            )}
          </div>
        </div>

        {/* LIVE FEED COLUMN */}
        <LiveFeed entries={feed} />
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="bg-accent/15 border-b border-accent/30 px-6 py-2 text-center text-[11px] text-accent font-mono uppercase tracking-widest">
      ★ Demo Mode — Simulated certificate stream + canned legal analyses · No live data, no API calls
    </div>
  );
}

function EmptyState({ filter, brand }: { filter: string; brand: string }) {
  return (
    <div className="border border-dashed border-border rounded-sm p-12 text-center">
      <div className="text-muted font-mono text-xs uppercase tracking-widest mb-3">
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
