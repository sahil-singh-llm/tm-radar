import { useEffect, useState } from 'react';
import type { ConnectionStatus } from '../lib/crtsh';
import type { BrandProfile } from '../lib/brandProfile';

type Props = {
  brand: string;
  status: ConnectionStatus;
  seen: number;
  flagged: number;
  critical: number;
  high: number;
  medium: number;
  perMinute: number;
  startedAt: number;
  onStop: () => void;
  brandProfile?: BrandProfile | null;
};

export function StatsBar({
  brand,
  status,
  seen,
  flagged,
  critical,
  high,
  medium,
  perMinute,
  startedAt,
  onStop,
  brandProfile,
}: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const uptime = formatDuration(Math.max(0, now - startedAt));

  return (
    <div className="border-b border-border bg-surface scanline-host">
      <div className="px-6 py-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Hex />
          <div>
            <div className="text-sm font-bold tracking-tight">TM Radar</div>
            <div className="text-[10px] text-muted font-mono uppercase tracking-widest">
              uptime {uptime}
            </div>
          </div>
        </div>

        <StatusPill status={status} />

        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted uppercase tracking-wider">Watching</span>
          <span className="font-mono text-base text-accent font-semibold">"{brand}"</span>
        </div>

        {brandProfile && (
          <span
            className="text-[10px] text-muted font-mono uppercase tracking-widest hidden md:inline"
            title="Brand context from Wikidata — community-curated, not a register source"
          >
            {brandProfile.label} · {brandProfile.industry ?? '—'} · {brandProfile.inception ?? '—'} · Wikidata
          </span>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-5 text-xs font-mono">
          <Stat label="Seen" value={seen.toLocaleString()} />
          <Divider />
          <Stat label="Flagged" value={flagged.toLocaleString()} accent="text" />
          <Divider />
          <Stat label="Critical" value={critical.toLocaleString()} accent="critical" />
          <Stat label="High" value={high.toLocaleString()} accent="high" />
          <Stat label="Medium" value={medium.toLocaleString()} accent="medium" />
          <Divider />
          <Stat label="dom/min" value={perMinute.toString()} />
        </div>

        <button
          onClick={onStop}
          className="text-xs font-mono uppercase tracking-wider px-3 py-1.5 border border-border hover:border-critical hover:text-critical text-muted rounded-sm transition-colors"
        >
          ■ Stop
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ConnectionStatus }) {
  const config: Record<ConnectionStatus, { dot: string; label: string; cls: string }> = {
    connecting: { dot: 'bg-medium', label: 'Connecting', cls: 'border-medium/40 text-medium' },
    connected: { dot: 'bg-low', label: 'Live', cls: 'border-low/40 text-low' },
    reconnecting: { dot: 'bg-high', label: 'Reconnecting', cls: 'border-high/40 text-high' },
    error: { dot: 'bg-critical', label: 'Error', cls: 'border-critical/40 text-critical' },
    demo: { dot: 'bg-accent', label: 'Demo Mode', cls: 'border-accent/40 text-accent' },
  };
  const c = config[status];
  return (
    <div className={`flex items-center gap-2 px-3 py-1 border rounded-sm font-mono text-[11px] uppercase tracking-wider ${c.cls}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
      {c.label}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = 'muted',
}: {
  label: string;
  value: string;
  accent?: 'muted' | 'text' | 'critical' | 'high' | 'medium';
}) {
  const cls =
    accent === 'critical'
      ? 'text-critical'
      : accent === 'high'
        ? 'text-high'
        : accent === 'medium'
          ? 'text-medium'
          : accent === 'text'
            ? 'text-text'
            : 'text-text';
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-muted text-[10px] uppercase tracking-wider">{label}</span>
      <span className={`font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <span className="text-border">│</span>;
}

function Hex() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
      <line x1="12" y1="22" x2="12" y2="15.5" />
      <polyline points="22 8.5 12 15.5 2 8.5" />
      <line x1="2" y1="15.5" x2="12" y2="8.5" />
      <line x1="12" y1="8.5" x2="22" y2="15.5" />
    </svg>
  );
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
