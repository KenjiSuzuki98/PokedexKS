import { useMemo, useState } from 'react';
import { calculateIV, refineByAppraisal, toIV, type BaseStats, type DustModifier } from '../core/iv/calc';
import type { IV } from '../core/types';

const BAR_LABELS = { atk: 'ataque', def: 'defesa', sta: 'PS' } as const;

export function IVCalculator(props: { base: BaseStats; cp: number | null; modifier: DustModifier; onUse: (iv: IV) => void }) {
  const [hp, setHp] = useState('');
  const [dust, setDust] = useState('');
  const [poweredUp, setPoweredUp] = useState(false);
  const [stars, setStars] = useState('');
  const [bars, setBars] = useState<Record<keyof typeof BAR_LABELS, string>>({ atk: '', def: '', sta: '' });

  const result = useMemo(() => {
    if (!props.cp || !hp || !dust) return null;
    const raw = calculateIV({ base: props.base, cp: props.cp, hp: Number(hp), dust: Number(dust), poweredUp, modifier: props.modifier });
    const num = (s: string) => (s === '' ? undefined : Number(s));
    return refineByAppraisal(raw, { stars: num(stars), bars: { atk: num(bars.atk), def: num(bars.def), sta: num(bars.sta) } });
  }, [props.base, props.cp, props.modifier, hp, dust, poweredUp, stars, bars]);

  const iv = result ? toIV(result) : null;

  return (
    <fieldset className="calc">
      <legend>Calculadora de IV</legend>
      {!props.cp && <p className="muted">Informe o CP acima.</p>}
      <label>PS<input inputMode="numeric" value={hp} onChange={(e) => setHp(e.target.value)} /></label>
      <label>Poeira<input inputMode="numeric" value={dust} onChange={(e) => setDust(e.target.value)} placeholder="custo para fortalecer" /></label>
      <label className="check"><input type="checkbox" checked={poweredUp} onChange={(e) => setPoweredUp(e.target.checked)} />Já fortalecido</label>
      <label>
        Estrelas
        <select value={stars} onChange={(e) => setStars(e.target.value)}>
          <option value="">—</option>
          {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {(Object.keys(BAR_LABELS) as (keyof typeof BAR_LABELS)[]).map((k) => (
        <label key={k}>
          Barras de {BAR_LABELS[k]}
          <select value={bars[k]} onChange={(e) => setBars({ ...bars, [k]: e.target.value })}>
            <option value="">—</option>
            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      ))}
      {result && (
        <p>
          {result.combos.length === 0
            ? 'Nenhuma combinação possível: confira CP, PS e poeira.'
            : `Faixa: ${result.min}% a ${result.max}% (${result.combos.length} combinações)`}
        </p>
      )}
      <button type="button" disabled={!iv} onClick={() => iv && props.onUse(iv)}>
        Usar resultado
      </button>
    </fieldset>
  );
}
