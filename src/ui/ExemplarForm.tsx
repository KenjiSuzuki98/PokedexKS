import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { computeCollection } from '../core/assign';
import { makeCode, registerBackground, slugify } from '../core/events';
import { calculateIV, type DustModifier } from '../core/iv/calc';
import { percentOf } from '../core/iv/parse';
import { parseScreenshotText } from '../core/screenshot';
import { addExemplar, addSpecies, exemplarWarnings, replaceExemplar } from '../core/ops';
import { regionOf } from '../core/region';
import type { BackgroundType, Collection, Exemplar, IV, Rocket, Sex, Size, Species, Status } from '../core/types';
import { useCollection } from './context';
import { newId, today } from './format';
import { recognizeImage } from './ocr';
import { SpeciesPicker } from './SpeciesPicker';

const NEW = '__novo';
// Campos opcionais controlados pelo formulário: são limpos e regravados a cada salvar.
const OPTIONAL: (keyof Exemplar)[] = ['iv', 'costumeId', 'backgroundId', 'dynamax', 'gigamax', 'eventId', 'notes', 'pendingFields'];
const OUT_LABEL: Record<Status, string> = { manter: '', trocar: 'Fora da Pokédex — troca', descartar: 'Fora da Pokédex — descarte' };
const REGION_LETTERS = ['A', 'G', 'H', 'P'];

const dex4 = (sp: Species) => String(sp.dex).padStart(4, '0') + (sp.form ?? '');

/** Espécie principal de um Nº (a sem letra de forma, ou a primeira). */
function baseOf(c: Collection, dex: number): Species | undefined {
  const same = c.species.filter((s) => s.dex === dex);
  return same.find((s) => !s.form) ?? same[0];
}

function Toggle<T extends string>(props: { label: string; value: T; options: [T, string, string][]; disabled?: (v: T) => boolean; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={props.label} className="toggle">
      {props.options.map(([v, text, aria]) => (
        <button
          key={v}
          type="button"
          aria-label={aria}
          aria-pressed={props.value === v}
          disabled={props.disabled?.(v)}
          onClick={() => props.onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const Auto = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="auto">
    <span>{label}</span>
    <output aria-label={label}>{children}</output>
  </div>
);

export function ExemplarForm({
  exemplarId,
  onDone,
  recognize = recognizeImage,
}: {
  exemplarId?: string;
  onDone: (id: string) => void;
  /** Lê o texto do print (padrão: OCR grátis no aparelho). */
  recognize?: (file: File) => Promise<string>;
}) {
  const { collection: c, result: r, update } = useCollection();
  const original = c.exemplars.find((e) => e.id === exemplarId);
  const originalSp = c.species.find((s) => s.id === original?.speciesId);

  const [pickedId, setPickedId] = useState(originalSp?.id ?? '');
  const [variationId, setVariationId] = useState(original?.speciesId ?? '');
  const [newVariation, setNewVariation] = useState('');
  const [atk, setAtk] = useState(original?.iv?.atk?.toString() ?? '');
  const [def, setDef] = useState(original?.iv?.def?.toString() ?? '');
  const [sta, setSta] = useState(original?.iv?.sta?.toString() ?? '');
  const [sex, setSex] = useState<Sex | ''>(original?.sex ?? '');
  const [size, setSize] = useState<Size>(original?.size ?? 'normal');
  const [rocket, setRocket] = useState<Rocket>(original?.rocket ?? 'normal');
  const [shiny, setShiny] = useState(original?.shiny ?? false);
  const [lucky, setLucky] = useState(original?.lucky ?? false);
  const [traded, setTraded] = useState(original?.origin === 'troca');
  const [dynamax, setDynamax] = useState(original?.dynamax ?? false);
  const [gigamax, setGigamax] = useState(original?.gigamax ?? false);
  const [costumeId, setCostumeId] = useState(original?.costumeId ?? '');
  const [backgroundId, setBackgroundId] = useState(original?.backgroundId ?? '');
  const [newBg, setNewBg] = useState({ name: '', type: 'localidade' as BackgroundType });
  const [eventId, setEventId] = useState(original?.eventId ?? '');
  const [notes, setNotes] = useState(original?.notes ?? '');
  const [error, setError] = useState('');
  const [calc, setCalc] = useState({ open: false, cp: '', hp: '', dust: '', poweredUp: false });
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState('');

  const options = useMemo(
    () => [...c.species].sort((a, b) => a.dex - b.dex || (a.form ?? '').localeCompare(b.form ?? '')),
    [c.species],
  );

  function choosePokemon(id: string) {
    setPickedId(id);
    setVariationId(id);
    setCostumeId('');
  }

  const variation = variationId === NEW ? undefined : c.species.find((s) => s.id === variationId);
  const picked = c.species.find((s) => s.id === pickedId);
  const base = variation ? baseOf(c, variation.dex) : picked ? baseOf(c, picked.dex) : undefined;
  const sp = variation ?? (variationId === NEW ? base : undefined);
  const variations = base ? options.filter((s) => s.dex === base.dex) : [];
  const fixedSex: Sex | null = sp?.gender === 'macho' || sp?.gender === 'femea' ? sp.gender : null;
  const effectiveSex: Sex | null = sp?.gender === 'ambos' ? sex || null : fixedSex;
  const origin = lucky || traded ? 'troca' : 'capturado';

  function readIV(): IV | undefined | 'erro' {
    const raw = [atk, def, sta];
    if (raw.every((v) => v.trim() === '')) return undefined;
    const n = raw.map(Number);
    if (!raw.every((v, i) => v.trim() !== '' && Number.isInteger(n[i]) && n[i]! >= 0 && n[i]! <= 15)) return 'erro';
    const [a, d, s] = n as [number, number, number];
    return { atk: a, def: d, sta: s, percent: percentOf(a, d, s) };
  }
  const iv = readIV();

  function build(speciesId: string): Exemplar {
    const kept = { ...(original ?? { id: newId(), date: today() }) } as Exemplar;
    for (const k of OPTIONAL) delete kept[k];
    return {
      ...kept,
      speciesId,
      ...(iv && iv !== 'erro' ? { iv } : {}),
      origin,
      sex: effectiveSex,
      size,
      shiny,
      lucky,
      rocket,
      ...(costumeId ? { costumeId } : {}),
      ...(backgroundId && backgroundId !== NEW ? { backgroundId } : {}),
      ...(dynamax ? { dynamax } : {}),
      ...(gigamax ? { gigamax } : {}),
      ...(eventId ? { eventId } : {}),
      ...(notes.trim() ? { notes } : {}),
    };
  }

  // Prévia do ID: calcula a coleção com este exemplar como ficaria ao salvar.
  const preview = useMemo(() => {
    if (!variation) return null;
    const draft = build(variation.id);
    const others = c.exemplars.filter((e) => e.id !== draft.id);
    return computeCollection({ ...c, exemplars: [...others, draft] }).exemplars[draft.id] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, variation, atk, def, sta, effectiveSex, size, shiny, lucky, rocket, costumeId, backgroundId, dynamax, gigamax, origin]);

  const draftForWarnings = variation ? build(variation.id) : null;
  // Calculadora de IV: PC, PS e poeira (vindos do print ou digitados).
  const modifier: DustModifier = lucky ? 'sortudo' : rocket === 'sombroso' ? 'sombroso' : rocket === 'purificado' ? 'purificado' : 'normal';
  const ivCalc = useMemo(() => {
    const [cpN, hpN, dustN] = [calc.cp, calc.hp, calc.dust].map(Number) as [number, number, number];
    if (!calc.open || !sp || !cpN || !hpN || !dustN) return null;
    const res = calculateIV({ base: sp.base, cp: cpN, hp: hpN, dust: dustN, poweredUp: calc.poweredUp, modifier });
    const seen = new Set<string>();
    const combos = res.combos.filter((x) => {
      const k = `${x.atk}/${x.def}/${x.sta}`;
      return seen.has(k) ? false : (seen.add(k), true);
    });
    return { ...res, combos };
  }, [calc, sp, modifier]);
  const applyCombo = (x: { atk: number; def: number; sta: number }) => {
    setAtk(String(x.atk));
    setDef(String(x.def));
    setSta(String(x.sta));
  };
  // Uma combinação só: preenche ATK/DEF/PS sozinho.
  useEffect(() => {
    if (ivCalc?.combos.length === 1) applyCombo(ivCalc.combos[0]!);
  }, [ivCalc]);

  async function readPrint(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setError('');
    setReading(true);
    try {
      const g = parseScreenshotText(c, r.slots, await recognize(file));
      const id = g.speciesId ?? g.candyOf;
      if (id) choosePokemon(id);
      if (g.sex) setSex(g.sex);
      if (g.size) setSize(g.size);
      if (g.rocket) setRocket(g.rocket);
      if (g.lucky) setLucky(true);
      if (g.traded) setTraded(true);
      setCalc({ ...calc, open: true, cp: g.cp?.toString() ?? '', hp: g.hp?.toString() ?? '', dust: g.dust?.toString() ?? '' });
      const missing = [!id && 'Pokémon', !g.cp && 'PC', !g.hp && 'PS', !g.dust && 'poeira'].filter(Boolean);
      setReadNote(
        `Print lido.${missing.length ? ` Não achei: ${missing.join(', ')}.` : ''} Confira brilhante, traje e fundo, que não aparecem como texto.`,
      );
    } catch {
      setError('Não consegui ler o print. Tente outra imagem ou preencha à mão.');
    } finally {
      setReading(false);
    }
  }

  const warnings = draftForWarnings ? exemplarWarnings(c, draftForWarnings).filter((w) => !/sortudo/i.test(w)) : [];

  function submit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    if (!base || (!variation && variationId !== NEW)) return setError('Escolha o Pokémon da lista (nome ou Nº).');
    if (iv === 'erro') return setError('ATK, DEF e PS: cada valor deve ser inteiro de 0 a 15.');
    if (variationId === NEW && !newVariation.trim()) return setError('Informe o nome da nova variação.');
    if (backgroundId === NEW && !newBg.name.trim()) return setError('Informe o nome do fundo novo.');

    let savedId = '';
    try {
      update((col) => {
        let next = col;
        let speciesId = variation?.id ?? '';
        if (variationId === NEW) {
          const taken = [...col.species.filter((s) => s.dex === base.dex).map((s) => s.form ?? ''), ...REGION_LETTERS];
          const name = `${base.name} (${newVariation.trim()})`;
          const created: Species = {
            ...base,
            id: `${base.id}-${slugify(newVariation)}`,
            name,
            form: makeCode(newVariation, taken, 2),
            mega: false,
            dynamax: false,
            gigamax: false,
            costumes: [],
          };
          next = addSpecies(next, created);
          speciesId = created.id;
        }
        let e = build(speciesId);
        if (backgroundId === NEW) {
          const r = registerBackground(next, { name: newBg.name.trim(), type: newBg.type, speciesId });
          next = r.collection;
          e = { ...e, backgroundId: r.background.id };
        }
        savedId = e.id;
        return original ? replaceExemplar(next, e) : addExemplar(next, e);
      });
      onDone(savedId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const backgrounds = c.backgrounds.filter((b) => !sp || b.species === 'todas' || b.species.includes(sp.id) || b.id === backgroundId);

  return (
    <form className="form exemplar-form" noValidate onSubmit={submit}>
      <div className="ef-top">
        <div className="ef-pokemon field">
          <span>Pokémon</span>
          <SpeciesPicker label="Pokémon" value={pickedId} onChange={choosePokemon} />
        </div>
        <div className="ef-auto">
          <Auto label="Nº Pokédex">{sp ? dex4(sp) + (variationId === NEW ? '+' : '') : '----'}</Auto>
          <Auto label="Região">{sp ? regionOf(sp.dex) : '--------'}</Auto>
          <Auto label="ID">
            {preview ? (preview.nickname ? `#${preview.nickname}` : OUT_LABEL[preview.status]) : '#_____'}
          </Auto>
        </div>
      </div>

      <div className="ef-print">
        <label className="file-button">
          📷 Ler print
          <input type="file" accept="image/*" aria-label="Ler print" onChange={readPrint} disabled={reading} />
        </label>
        <button type="button" aria-expanded={calc.open} onClick={() => setCalc({ ...calc, open: !calc.open })}>
          🧮 IV por PC/PS/poeira
        </button>
        {reading && <span className="muted">Lendo print…</span>}
      </div>
      {readNote && <p className="muted" role="status">{readNote}</p>}
      {calc.open && (
        <fieldset className="ef-calc">
          <legend>Calcular IV</legend>
          <label>PC<input type="number" inputMode="numeric" value={calc.cp} onChange={(e) => setCalc({ ...calc, cp: e.target.value })} /></label>
          <label>PS máximo<input type="number" inputMode="numeric" value={calc.hp} onChange={(e) => setCalc({ ...calc, hp: e.target.value })} /></label>
          <label>Poeira<input type="number" inputMode="numeric" value={calc.dust} onChange={(e) => setCalc({ ...calc, dust: e.target.value })} /></label>
          <label className="check">
            <input type="checkbox" checked={calc.poweredUp} onChange={(e) => setCalc({ ...calc, poweredUp: e.target.checked })} />
            Já fortalecido
          </label>
          {ivCalc && ivCalc.combos.length === 0 && <p className="warn">Nenhuma combinação bate. Confira PC, PS, poeira e Pokémon.</p>}
          {ivCalc && ivCalc.combos.length > 1 && (
            <div className="combos">
              <p className="muted">IV entre {ivCalc.min}% e {ivCalc.max}%. Escolha a combinação (a avaliação do jogo ajuda):</p>
              {ivCalc.combos.slice(0, 40).map((x) => (
                <button key={`${x.atk}/${x.def}/${x.sta}`} type="button" onClick={() => applyCombo(x)}>
                  {x.atk}/{x.def}/{x.sta} ({x.percent}%)
                </button>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <div className="ef-mid">
        <div className="ef-checks">
          <label className="check"><input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} />Brilhante</label>
          <label className="check"><input type="checkbox" checked={lucky} onChange={(e) => setLucky(e.target.checked)} />Sortudo</label>
          <label className="check"><input type="checkbox" checked={dynamax} onChange={(e) => setDynamax(e.target.checked)} />Dinamax</label>
          <label className="check"><input type="checkbox" checked={gigamax} onChange={(e) => setGigamax(e.target.checked)} />Gigamax</label>
          <label className="check">
            <input type="checkbox" checked={lucky || traded} disabled={lucky} onChange={(e) => setTraded(e.target.checked)} />
            Recebido em troca
          </label>
        </div>
        <div className="ef-stats">
          <div className="ef-iv">
            {(['ATK', 'DEF', 'PS'] as const).map((label, i) => {
              const [value, set] = [[atk, setAtk], [def, setDef], [sta, setSta]][i] as [string, (v: string) => void];
              return (
                <label key={label}>
                  {label}
                  <input type="number" min={0} max={15} inputMode="numeric" value={value} onChange={(e) => set(e.target.value)} />
                </label>
              );
            })}
            <Auto label="IV %">{iv && iv !== 'erro' ? iv.percent : '--'}</Auto>
          </div>
          <Toggle
            label="Sexo"
            value={(effectiveSex ?? '') as Sex | ''}
            options={[['', '∅', 'Não informado'], ['macho', '♂', 'Macho'], ['femea', '♀', 'Fêmea']]}
            disabled={(v) => !!sp && sp.gender !== 'ambos' && v !== (fixedSex ?? '')}
            onChange={setSex}
          />
          <Toggle
            label="Tamanho"
            value={size}
            options={[['normal', '∅', 'Normal'], ['xxs', 'XXS', 'XXS'], ['xxl', 'XXL', 'XXL']]}
            onChange={setSize}
          />
          <Toggle
            label="Rocket"
            value={rocket}
            options={[['normal', 'Nenhum', 'Nenhum'], ['sombroso', 'Som', 'Sombroso'], ['purificado', 'Pur', 'Purificado']]}
            onChange={setRocket}
          />
        </div>
      </div>

      <label>
        Variação
        <select value={variationId} onChange={(e) => { setVariationId(e.target.value); setCostumeId(''); }} disabled={!base}>
          {!base && <option value="">—</option>}
          {variations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          {base && <option value={NEW}>nova variação…</option>}
        </select>
      </label>
      {variationId === NEW && (
        <label>Nome da nova variação<input value={newVariation} placeholder="ex.: Libre" onChange={(e) => setNewVariation(e.target.value)} /></label>
      )}

      <label>
        Traje
        <select value={costumeId} onChange={(e) => setCostumeId(e.target.value)}>
          <option value="">sem traje</option>
          {variation?.costumes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <p className="muted hint">Traje novo: cadastre no evento, na Linha do tempo.</p>

      <label>
        Fundo
        <select value={backgroundId} onChange={(e) => setBackgroundId(e.target.value)}>
          <option value="">sem fundo</option>
          {backgrounds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          <option value={NEW}>novo fundo…</option>
        </select>
      </label>
      {backgroundId === NEW && (
        <>
          <label>Nome do fundo novo<input value={newBg.name} onChange={(e) => setNewBg({ ...newBg, name: e.target.value })} /></label>
          <label>
            Tipo do fundo
            <select value={newBg.type} onChange={(e) => setNewBg({ ...newBg, type: e.target.value as BackgroundType })}>
              <option value="localidade">localidade</option>
              <option value="especial">especial</option>
              <option value="aventura">efeito de aventura</option>
            </select>
          </label>
        </>
      )}

      <label>
        Evento de origem
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">—</option>
          {c.events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </label>
      <label>Notas<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>

      {warnings.length > 0 && (
        <ul className="warn">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="primary">Salvar</button>
    </form>
  );
}
