import { useState } from 'react';
import type { DetectionResult, Severity } from '../lib/detection';
import type { AnalysisStage } from '../lib/claude';

export type AlertEntry = {
  result: DetectionResult;
  createdAt: number;
  analysis: string | null;
  analysisStage: AnalysisStage;
  websiteFetched: boolean;
  websiteUnreachable: boolean;
  error?: string;
};

type Props = {
  entry: AlertEntry;
  onRequestAnalysis: (domain: string) => void;
};

export function DomainAlert({ entry, onRequestAnalysis }: Props) {
  const { result, analysis, analysisStage, websiteFetched, websiteUnreachable, error } = entry;
  const [expanded, setExpanded] = useState(result.severity === 'critical' || result.severity === 'high');
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
              className="font-mono text-base font-semibold text-text truncate hover:underline decoration-dotted underline-offset-4"
              title={result.domain}
            >
              {result.domain}
            </a>
            <SeverityBadge sev={sev} score={result.score} />
          </div>

          <ScoreBar score={result.score} />

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {result.reasons.map((r, i) => (
              <ReasonTag key={i} text={r} />
            ))}
          </div>

          {/* Analysis section */}
          <div className="mt-3 border-t border-border/60 pt-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted hover:text-text transition-colors"
            >
              <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
              AI Analysis
              {analysisStage === 'pending' && <Spinner />}
              {analysisStage === 'domain-only' && (
                <span className="text-medium">· domain stage</span>
              )}
              {analysisStage === 'enriched' && (
                <span className="text-low">· enriched</span>
              )}
              {websiteUnreachable && (
                <span className="text-muted text-[10px]">· site not yet live</span>
              )}
            </button>

            {expanded && (
              <div className="mt-3 text-sm leading-relaxed">
                {analysisStage === 'idle' && (
                  <button
                    onClick={() => onRequestAnalysis(result.domain)}
                    className="px-3 py-1.5 border border-accent/50 text-accent hover:bg-accent/10 text-xs font-mono uppercase tracking-wider transition-colors rounded-sm"
                  >
                    Request Analysis
                  </button>
                )}
                {analysisStage === 'pending' && !analysis && (
                  <div className="flex items-center gap-2 text-muted text-xs italic">
                    <Spinner />
                    Analyzing domain...
                  </div>
                )}
                {analysisStage === 'error' && (
                  <div className="text-critical text-xs font-mono">
                    Analysis failed: {error ?? 'Unknown error'}
                    <button
                      onClick={() => onRequestAnalysis(result.domain)}
                      className="ml-2 underline hover:text-text"
                    >
                      retry
                    </button>
                  </div>
                )}
                {analysis && (
                  <>
                    <div className="text-text/95 whitespace-pre-wrap text-[13px]">{analysis}</div>
                    {analysisStage === 'domain-only' && !websiteUnreachable && (
                      <div className="mt-2 text-[11px] text-muted font-mono italic flex items-center gap-2">
                        <Spinner small /> fetching website for enriched analysis...
                      </div>
                    )}
                    {websiteFetched && analysisStage === 'enriched' && (
                      <div className="mt-2 text-[11px] text-low font-mono">
                        ✓ Website content incorporated
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton
              href={`https://whois.domaintools.com/${encodeURIComponent(result.domain)}`}
              label="WHOIS"
            />
            <ActionButton
              href="https://www.wipo.int/amc/en/domains/"
              label="UDRP Info"
            />
            <button
              onClick={copyDomain}
              className="px-2.5 py-1 border border-border hover:border-accent text-muted hover:text-accent text-[11px] font-mono uppercase tracking-wider transition-colors rounded-sm"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative h-1.5 bg-bg border border-border rounded-sm overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 score-bar"
        style={{ width: `${Math.min(100, score)}%` }}
      />
    </div>
  );
}

function SeverityIcon({ sev }: { sev: Severity }) {
  const cls: Record<Severity, string> = {
    critical: 'text-critical',
    high: 'text-high',
    medium: 'text-medium',
    low: 'text-low',
  };
  const dot: Record<Severity, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };
  return (
    <div className={`flex-none mt-0.5 text-base ${cls[sev]}`} aria-hidden>
      {dot[sev]}
    </div>
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
      className="px-2.5 py-1 border border-border hover:border-accent text-muted hover:text-accent text-[11px] font-mono uppercase tracking-wider transition-colors rounded-sm"
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
