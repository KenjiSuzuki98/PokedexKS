import type { Progress } from '../core/progress';

/** Barra horizontal fina de 0 a 100%, com "XX% X/Y"; reservas aparecem à parte. */
export function Gauge({ label, p }: { label: string; p: Progress }) {
  const pct = Math.round(p.percent);
  const reservedPct = p.total ? (p.reserved / p.total) * 100 : 0;
  return (
    <div className="gauge" role="meter" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="gauge-head">
        <span className="gauge-label">{label}</span>
        <span className="gauge-value">
          {pct}% {p.filled}/{p.total}
          {p.reserved > 0 && <small> +{p.reserved} reservadas</small>}
        </span>
      </div>
      <div className="bar" aria-hidden="true">
        <div className="bar-fill" style={{ width: `${p.percent}%` }} />
        <div className="bar-reserved" style={{ width: `${reservedPct}%` }} />
      </div>
    </div>
  );
}
