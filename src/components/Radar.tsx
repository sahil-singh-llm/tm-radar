import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Severity } from '../lib/detection';
import type { AlertEntry } from './DomainAlert';

export type FeedEntry = {
  domain: string;
  flagged: boolean;
  ts: number;
};

type Props = {
  entries: FeedEntry[];
  alerts: AlertEntry[];
  brand: string;
};

const SEV_RGB: Record<Severity, [number, number, number]> = {
  critical: [239, 68, 68],
  high: [249, 115, 22],
  medium: [234, 179, 8],
  low: [34, 197, 94],
};

const SEV_RING_FRACTION: Record<Severity, number> = {
  critical: 0.22,
  high: 0.42,
  medium: 0.58,
  low: 0.72,
};

const SEV_LIFE_MS: Record<Severity, number> = {
  critical: 90_000,
  high: 45_000,
  medium: 22_000,
  low: 14_000,
};

const SEV_DOT_PX: Record<Severity, number> = {
  critical: 3.4,
  high: 3.0,
  medium: 2.6,
  low: 2.4,
};

const SWEEP_PERIOD_S = 6;
const TRAIL_DEG = 70;
const TRAIL_RAD = (TRAIL_DEG * Math.PI) / 180;
const NOISE_LIFE_MS = 5_000;
const BOOT_DURATION_MS = 1800;

function fadeIn(elapsed: number, startMs: number, durMs: number): number {
  if (elapsed < startMs) return 0;
  if (elapsed >= startMs + durMs) return 1;
  const t = (elapsed - startMs) / durMs;
  return 1 - Math.pow(1 - t, 3);
}

function hashTo01(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function angularDist(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d < 0) d += Math.PI * 2;
  return d > Math.PI ? Math.PI * 2 - d : d;
}

export const Radar = memo(function Radar({ entries, alerts, brand }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const sweepRef = useRef(0);
  const lastTsRef = useRef(Date.now());
  const bootStartedAtRef = useRef(Date.now());
  const dprRef = useRef(1);
  const [bootLabel, setBootLabel] = useState<string | null>('calibrating');

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const sevMap = useMemo(() => {
    const m = new Map<string, { sev: Severity; bornAt: number }>();
    for (const a of alerts) {
      m.set(a.result.domain, { sev: a.result.severity, bornAt: a.createdAt });
    }
    return m;
  }, [alerts]);

  const sevMapRef = useRef(sevMap);
  sevMapRef.current = sevMap;

  useEffect(() => {
    const wrap = containerRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.max(160, Math.floor(rect.width));
      dprRef.current = dpr;
      canvas.width = Math.floor(px * dpr);
      canvas.height = Math.floor(px * dpr);
      canvas.style.width = `${px}px`;
      canvas.style.height = `${px}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - lastTsRef.current) / 1000);
      lastTsRef.current = now;
      const elapsedBoot = now - bootStartedAtRef.current;
      const speedRamp = fadeIn(elapsedBoot, 700, 1000);
      sweepRef.current =
        (sweepRef.current + (speedRamp * dt * Math.PI * 2) / SWEEP_PERIOD_S) % (Math.PI * 2);
      try {
        draw(now);
      } catch (e) {
        console.error('[radar] draw error', e);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const t1 = window.setTimeout(() => setBootLabel(`tracking "${brand}"`), 700);
    const t2 = window.setTimeout(() => setBootLabel(null), 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw(now: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const dpr = dprRef.current;
    if (W === 0 || H === 0) return;

    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 10 * dpr;

    ctx.clearRect(0, 0, W, H);

    const elapsedBoot = now - bootStartedAtRef.current;
    const isBooting = elapsedBoot < BOOT_DURATION_MS;
    const bgAlpha = fadeIn(elapsedBoot, 0, 400);
    const ringAlphas = [0, 1, 2, 3].map((i) => fadeIn(elapsedBoot, 200 + i * 80, 220));
    const crossAlpha = fadeIn(elapsedBoot, 600, 220);
    const tickAlpha = fadeIn(elapsedBoot, 800, 220);
    const sweepAlpha = fadeIn(elapsedBoot, 700, 400);
    const centerAlpha = fadeIn(elapsedBoot, 200, 220);

    if (bgAlpha > 0) {
      ctx.globalAlpha = bgAlpha;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      bg.addColorStop(0, 'rgba(37, 99, 235, 0.07)');
      bg.addColorStop(0.7, 'rgba(37, 99, 235, 0.018)');
      bg.addColorStop(1, 'rgba(37, 99, 235, 0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i < 4; i++) {
      const a = ringAlphas[i];
      if (a <= 0) continue;
      ctx.strokeStyle = `rgba(30, 45, 74, ${0.85 * a})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R * (i + 1) * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (crossAlpha > 0) {
      ctx.strokeStyle = `rgba(30, 45, 74, ${0.6 * crossAlpha})`;
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.stroke();
    }

    if (tickAlpha > 0) {
      ctx.strokeStyle = `rgba(100, 116, 139, ${0.5 * tickAlpha})`;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const r1 = R * 0.96;
        const r2 = R * 1.0;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
      }
    }

    const sweep = sweepRef.current;
    if (sweepAlpha > 0) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweep - Math.PI / 2);
      for (let s = 0; s < TRAIL_DEG; s += 2) {
        const a0 = -((s + 2) * Math.PI) / 180;
        const a1 = -(s * Math.PI) / 180;
        const t = s / TRAIL_DEG;
        const alpha = Math.pow(1 - t, 1.7) * 0.26 * sweepAlpha;
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R, a0, a1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowColor = `rgba(186, 230, 253, ${0.7 * sweepAlpha})`;
      ctx.shadowBlur = 6 * dpr;
      ctx.strokeStyle = `rgba(186, 230, 253, ${0.98 * sweepAlpha})`;
      ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(R, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    if (isBooting) {
      if (centerAlpha > 0) {
        ctx.globalAlpha = centerAlpha;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(186, 230, 253, 0.95)';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.6 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }

    const ents = entriesRef.current;
    for (const e of ents) {
      if (e.flagged) continue;
      const ageMs = now - e.ts;
      if (ageMs < 0 || ageMs > NOISE_LIFE_MS) continue;
      const a = hashTo01(e.domain) * Math.PI * 2 - Math.PI / 2;
      const radial = 0.8 + hashTo01(e.domain + '#r') * 0.18;
      const r = R * radial;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const fade = Math.max(0, 1 - ageMs / NOISE_LIFE_MS);
      const sweepDelta = angularDist(sweep, a + Math.PI / 2);
      const sweepBoost = sweepDelta < TRAIL_RAD ? (1 - sweepDelta / TRAIL_RAD) * 0.7 : 0;
      ctx.fillStyle = `rgba(148, 163, 184, ${fade * 0.4 + sweepBoost * 0.55})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.4 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    sevMapRef.current.forEach((info, domain) => {
      const ageMs = now - info.bornAt;
      const lifeMs = SEV_LIFE_MS[info.sev];
      const life = Math.max(0, 1 - ageMs / lifeMs);
      if (life <= 0) return;

      const angle = hashTo01(domain) * Math.PI * 2 - Math.PI / 2;
      const baseDist = SEV_RING_FRACTION[info.sev];
      const jitter = (hashTo01(domain + '#j') - 0.5) * 0.08;
      const r = R * Math.max(0.08, baseDist + jitter);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      const [cr, cg, cb] = SEV_RGB[info.sev];

      const sweepDelta = angularDist(sweep, angle + Math.PI / 2);
      const sweepBoost = sweepDelta < TRAIL_RAD ? (1 - sweepDelta / TRAIL_RAD) : 0;

      const haloR = (info.sev === 'critical' ? 22 : info.sev === 'high' ? 18 : 14) * dpr;
      const haloAlpha = 0.45 * life + sweepBoost * 0.4;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
      halo.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${haloAlpha})`);
      halo.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, haloR, 0, Math.PI * 2);
      ctx.fill();

      if (ageMs >= 0 && ageMs < 1300) {
        const t = ageMs / 1300;
        const eased = 1 - Math.pow(1 - t, 3);
        const ringR = Math.max(0, (4 + eased * 28) * dpr);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.max(0, (1 - eased) * 0.85)})`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.arc(x, y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      const dotR = SEV_DOT_PX[info.sev] * dpr;
      const dotAlpha = Math.min(1, life + sweepBoost * 0.6);
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${dotAlpha})`;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fill();

      if (info.sev === 'critical') {
        const designR = (dotR + 5 * dpr);
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.55 * life + sweepBoost * 0.35})`;
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.arc(x, y, designR, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(186, 230, 253, 0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  const ticker = entries.slice(0, 5);

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
          <span className="relative w-2 h-2 inline-block">
            <span className="absolute inset-0 rounded-full bg-low animate-pulse opacity-70" />
            <span className="absolute inset-0 rounded-full bg-low scale-50" />
          </span>
          Live Radar
        </h2>
        <span
          className="text-[10px] font-mono text-muted uppercase tracking-wider"
          title={`tracking similar domains for "${brand}"`}
        >
          {alerts.length} {alerts.length === 1 ? 'contact' : 'contacts'}
        </span>
      </div>

      <div ref={containerRef} className="relative w-full aspect-square select-none">
        <canvas ref={canvasRef} className="block w-full h-full" />
        <span
          className={`pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-widest text-sky-300/85 transition-opacity duration-300 ${
            bootLabel ? 'opacity-100' : 'opacity-0'
          }`}
        >
          ▸ {bootLabel ?? ''}
        </span>
        <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-muted/60 tracking-widest">
          N
        </span>
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted/60 tracking-widest">
          E
        </span>
        <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-muted/60 tracking-widest">
          S
        </span>
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted/60 tracking-widest">
          W
        </span>
      </div>

      <div className="border-t border-border px-4 py-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
            Recent traffic
          </span>
          <span className="text-[10px] font-mono text-muted/60">last {ticker.length}</span>
        </div>
        <ul className="text-[11px] font-mono leading-snug overflow-hidden">
          {ticker.length === 0 && (
            <li className="text-muted/60 italic">awaiting certificate stream...</li>
          )}
          {ticker.map((e) => (
            <li
              key={e.ts + ':' + e.domain}
              className={`truncate animate-feedIn py-px ${
                e.flagged ? 'text-medium' : 'text-muted/80'
              }`}
              title={e.domain}
            >
              <span className="text-border mr-1.5">›</span>
              {e.domain}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});
