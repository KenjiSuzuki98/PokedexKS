import type { Progress } from '../core/progress';

/** Gauge circular com % e x/y; reservas aparecem à parte. */
export function Gauge({ label, p, size = 'md' }: { label: string; p: Progress; size?: 'md' | 'lg' }) {
  const pct = Math.round(p.percent);
  const r = 16;
  const len = 2 * Math.PI * r;
  const reservedPct = p.total ? (p.reserved / p.total) * 100 : 0;
  return (
    <div className={`gauge ${size}`} role="meter" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle className="track" cx="20" cy="20" r={r} />
        <circle className="reserved" cx="20" cy="20" r={r} strokeDasharray={`${(len * (p.percent + reservedPct)) / 100} ${len}`} />
        <circle className="fill" cx="20" cy="20" r={r} strokeDasharray={`${(len * p.percent) / 100} ${len}`} />
      </svg>
      <div className="gauge-text">
        <strong>{pct}%</strong>
        <span>
          {p.filled}/{p.total}
        </span>
        {p.reserved > 0 && <small>mais {p.reserved} reservadas</small>}
      </div>
      <span className="gauge-label">{label}</span>
    </div>
  );
}
