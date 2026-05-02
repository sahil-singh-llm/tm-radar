import { useState } from 'react';
import type { DetectionResult, Severity } from '../lib/detection';
import type { AnalysisStage } from '../lib/claude';
import type { CertMeta } from '../lib/crtsh';

export type AlertEntry = {
  result: DetectionResult;
  createdAt: number;
  analysis: string | null;
  analysisStage: AnalysisStage;
  websiteFetched: boolean;
  websiteUnreachable: boolean;
  screenshotUrl: string | null;
  screenshotPending: boolean;
  certMeta?: CertMeta;
  error?: string;
};

type Props = {
  entry: AlertEntry;
  brand: string;
  onRequestAnalysis: (domain: string) => void;
};

export function DomainAlert({ entry, brand, onRequestAnalysis }: Props) {
  const { result, analysis, analysisStage, websiteFetched, websiteUnreachable, error } = entry;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const sev = result.severity;
  const sevClass = `severity-${sev}`;
  const flashClass = sev === 'critical' ? 'animate-flash' : '';

  const copyDomain = async () => {
    try {
      await navigator.clipboard.writeText(result.domain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`border rounded-sm p-4 ${sevClass} ${flashClass} animate-slideIn`}
      role="article"
      aria-label={`Alert: ${result.domain}`}
    >
      <div className="flex items-start gap-3">
        <SeverityIcon sev={sev} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <a
              href={`https://${result.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-base font-semibold text-text truncate hover:underline decoration-dotted underline-offset-4 rounded-sm focus-ring"
              title={result.domain}
            >
              {result.domain}
            </a>
            <SeverityBadge sev={sev} score={result.score} />
          </div>

          <ScoreBar score={result.score} sev={sev} />

          {entry.certMeta && (entry.certMeta.issuer || entry.certMeta.notBefore) && (
            <CertMetaLine meta={entry.certMeta} />
          )}

          <div className="flex items-center gap-3 mt-2.5">
            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
              {result.reasons.map((r, i) => (
                <ReasonTag key={i} text={r} />
              ))}
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex-none flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-muted hover:text-text border border-border hover:border-accent transition-colors rounded-sm focus-ring"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
              <span>Details</span>
              <CompactStatus stage={analysisStage} hasError={!!error} />
            </button>
          </div>

          {expanded && (
            <div className="mt-3 border-t border-border/60 pt-3 space-y-3">
              {(entry.screenshotUrl || entry.screenshotPending) && (
                <ScreenshotPreview
                  url={entry.screenshotUrl}
                  pending={entry.screenshotPending}
                  domain={result.domain}
                />
              )}

              <AnalysisSection
                analysis={analysis}
                stage={analysisStage}
                websiteFetched={websiteFetched}
                websiteUnreachable={websiteUnreachable}
                error={error}
                domain={result.domain}
                onRequestAnalysis={onRequestAnalysis}
              />

              <div className="flex flex-wrap gap-2 pt-1">
                <ActionButton
                  href={`https://whois.domaintools.com/${encodeURIComponent(result.domain)}`}
                  label="WHOIS"
                />
                <ActionButton
                  href={`https://www.tmdn.org/tmview/?text=${encodeURIComponent(brand)}`}
                  label="TMview"
                />
                <ActionButton
                  href="https://www.wipo.int/amc/en/domains/"
                  label="UDRP Info"
                />
                <button
                  onClick={copyDomain}
                  className="px-2.5 py-1 border border-border hover:border-accent text-muted hover:text-accent text-[11px] font-mono uppercase tracking-wider transition-colors rounded-sm focus-ring"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompactStatus({
  stage,
  hasError,
}: {
  stage: AnalysisStage;
  hasError: boolean;
}) {
  if (hasError || stage === 'error') {
    return <span className="text-critical normal-case tracking-normal">· error</span>;
  }
  if (stage === 'pending') {
    return (
      <span className="flex items-center gap-1">
        <Spinner small />
      </span>
    );
  }
  if (stage === 'enriched') {
    return <span className="text-low normal-case tracking-normal">· ✓</span>;
  }
  if (stage === 'domain-only') {
    return <span className="text-medium normal-case tracking-normal">· ~</span>;
  }
  return null;
}

function AnalysisSection({
  analysis,
  stage,
  websiteFetched,
  websiteUnreachable,
  error,
  domain,
  onRequestAnalysis,
}: {
  analysis: string | null;
  stage: AnalysisStage;
  websiteFetched: boolean;
  websiteUnreachable: boolean;
  error?: string;
  domain: string;
  onRequestAnalysis: (d: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted mb-2">
        <span>AI Analysis</span>
        {stage === 'pending' && <Spinner />}
        {stage === 'domain-only' && <span className="text-medium">· domain stage</span>}
        {stage === 'enriched' && <span className="text-low">· enriched</span>}
        {websiteUnreachable && (
          <span className="text-muted text-[10px]">· site not yet live</span>
        )}
      </div>

      {stage === 'idle' && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted">
            Below the similarity threshold — auto-analysis was skipped. Click below to analyze on demand.
          </p>
          <button
            onClick={() => onRequestAnalysis(domain)}
            className="px-3 py-1.5 border border-accent/50 text-accent hover:bg-accent/10 text-xs font-mono uppercase tracking-wider transition-colors rounded-sm focus-ring"
          >
            Request Analysis
          </button>
        </div>
      )}
      {stage === 'pending' && !analysis && (
        <div className="flex items-center gap-2 text-muted text-xs italic">
          <Spinner />
          Analyzing domain...
        </div>
      )}
      {stage === 'error' && (
        <div className="text-critical text-xs font-mono">
          Analysis failed: {error ?? 'Unknown error'}
          <button
            onClick={() => onRequestAnalysis(domain)}
            className="ml-2 underline hover:text-text rounded-sm focus-ring"
          >
            retry
          </button>
        </div>
      )}
      {analysis && (
        <>
          <div className="text-text/95 whitespace-pre-wrap text-[13px] leading-relaxed">
            {analysis}
          </div>
          {stage === 'domain-only' && !websiteUnreachable && (
            <div className="mt-2 text-[11px] text-muted font-mono italic flex items-center gap-2">
              <Spinner small /> fetching website for enriched analysis...
            </div>
          )}
          {websiteFetched && stage === 'enriched' && (
            <div className="mt-2 text-[11px] text-low font-mono">
              ✓ Website content incorporated
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScreenshotPreview({
  url,
  pending,
  domain,
}: {
  url: string | null;
  pending: boolean;
  domain: string;
}) {
  if (pending && !url) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted font-mono italic">
        <Spinner small /> capturing homepage screenshot...
      </div>
    );
  }
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-fit border border-border hover:border-accent rounded-sm overflow-hidden transition-colors"
      title={`Open full-size screenshot of ${domain}`}
    >
      <img
        src={url}
        alt={`Homepage screenshot of ${domain}`}
        className="block max-w-[280px] w-full h-auto"
        loading="lazy"
      />
    </a>
  );
}

function ScoreBar({ score, sev }: { score: number; sev: Severity }) {
  const fill: Record<Severity, string> = {
    critical: 'bg-critical',
    high: 'bg-high',
    medium: 'bg-medium',
    low: 'bg-low',
  };
  return (
    <div
      className="relative h-1.5 bg-bg border border-border rounded-sm overflow-hidden"
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Severity score ${score} of 100`}
    >
      <div
        className={`absolute inset-y-0 left-0 ${fill[sev]}`}
        style={{ width: `${Math.min(100, score)}%` }}
      />
    </div>
  );
}

function SeverityIcon({ sev }: { sev: Severity }) {
  const fill: Record<Severity, string> = {
    critical: 'bg-critical',
    high: 'bg-high',
    medium: 'bg-medium',
    low: 'bg-low',
  };
  const ring: Record<Severity, string> = {
    critical: 'bg-critical/30',
    high: 'bg-high/30',
    medium: 'bg-medium/30',
    low: 'bg-low/30',
  };
  return (
    <span
      className="relative flex-none mt-1.5 inline-flex items-center justify-center w-3.5 h-3.5"
      aria-hidden
    >
      <span className={`absolute inset-0 rounded-full ${ring[sev]} ${sev === 'critical' ? 'animate-pulse' : ''}`} />
      <span className={`relative w-2 h-2 rounded-full ${fill[sev]}`} />
    </span>
  );
}

function SeverityBadge({ sev, score }: { sev: Severity; score: number }) {
  const cls: Record<Severity, string> = {
    critical: 'bg-critical/15 text-critical border-critical/40',
    high: 'bg-high/15 text-high border-high/40',
    medium: 'bg-medium/15 text-medium border-medium/40',
    low: 'bg-low/15 text-low border-low/40',
  };
  return (
    <div className="flex items-center gap-2 flex-none">
      <span className="font-mono text-xs text-muted">Score</span>
      <span className="font-mono text-base font-bold tabular-nums">{score}</span>
      <span className={`px-2 py-0.5 border text-[10px] font-mono uppercase tracking-widest font-semibold ${cls[sev]}`}>
        {sev}
      </span>
    </div>
  );
}

function ReasonTag({ text }: { text: string }) {
  return (
    <span className="px-2 py-0.5 bg-bg border border-border text-[10px] font-mono uppercase tracking-wider text-muted rounded-sm">
      {text}
    </span>
  );
}

function ActionButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="px-2.5 py-1 border border-border hover:border-accent text-muted hover:text-accent text-[11px] font-mono uppercase tracking-wider transition-colors rounded-sm focus-ring"
    >
      {label} ↗
    </a>
  );
}

function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? 'w-3 h-3 border' : 'w-3.5 h-3.5 border-2';
  return (
    <span
      className={`${size} border-accent border-t-transparent rounded-full animate-spin inline-block`}
      aria-label="loading"
    />
  );
}

function CertMetaLine({ meta }: { meta: CertMeta }) {
  const ageDays = meta.notBefore ? daysBetween(meta.notBefore, Date.now()) : null;
  const remainingDays = meta.notAfter ? daysBetween(Date.now(), meta.notAfter) : null;

  // Fresh certs (<7 days) on a flagged domain are a stronger signal than old ones.
  const isFresh = ageDays !== null && ageDays >= 0 && ageDays < 7;
  // Short-lived certs near expiry are noteworthy too.
  const isExpiringSoon = remainingDays !== null && remainingDays >= 0 && remainingDays < 14;

  return (
    <div className="flex items-center gap-3 text-[10px] font-mono mt-2 flex-wrap">
      {meta.issuer && (
        <span className="text-muted/80">
          <span className="text-muted/50">CA</span>{' '}
          <span className="text-muted">{meta.issuer}</span>
        </span>
      )}
      {ageDays !== null && (
        <span className={isFresh ? 'text-medium' : 'text-muted/80'}>
          <span className="text-muted/50">issued</span>{' '}
          {formatDayDelta(ageDays)} ago
        </span>
      )}
      {remainingDays !== null && (
        <span className={isExpiringSoon ? 'text-medium' : 'text-muted/80'}>
          <span className="text-muted/50">expires in</span>{' '}
          {remainingDays < 0 ? 'expired' : formatDayDelta(remainingDays)}
        </span>
      )}
    </div>
  );
}

function daysBetween(a: number | string, b: number | string): number {
  const aMs = typeof a === 'number' ? a : new Date(a).getTime();
  const bMs = typeof b === 'number' ? b : new Date(b).getTime();
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return NaN;
  return Math.floor((bMs - aMs) / 86_400_000);
}

function formatDayDelta(days: number): string {
  const d = Math.abs(days);
  if (d < 1) return '<1d';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${Math.round(d / 365)}y`;
}
