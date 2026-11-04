import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { computeCollection } from '../core/assign';
import { addCostume, makeCode, registerBackground, slugify } from '../core/events';
import { percentOf } from '../core/iv/parse';
import { addExemplar, addSpecies, exemplarWarnings, replaceExemplar } from '../core/ops';
import { regionOf } from '../core/region';
import type { BackgroundType, Collection, Exemplar, IV, Rocket, Sex, Size, Species, Status } from '../core/types';
import { useCollection } from './context';
import { newId, today } from './format';

const NEW = '__novo';
// Campos opcionais controlados pelo formulário: são limpos e regravados a cada salvar.
const OPTIONAL: (keyof Exemplar)[] = ['iv', 'costumeId', 'backgroundId', 'dynamax', 'gigamax', 'eventId', 'notes', 'pendingFields'];
const OUT_LABEL: Record<Status, string> = { manter: '', trocar: 'Fora da Pokédex — troca', descartar: 'Fora da Pokédex — descarte' };
const REGION_LETTERS = ['A', 'G', 'H', 'P'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const dex4 = (sp: Species) => String(sp.dex).padStart(4, '0') + (sp.form ?? '');

/** Espécie principal de um Nº (a sem letra de forma, ou a primeira). */
function baseOf(c: Collection, dex: number): Species | undefined {
  const same = c.species.filter((s) => s.dex === dex);
  return same.find((s) => !s.form) ?? same[0];
}

/** Resolve o que foi digitado no campo Pokémon: nome (de espécie ou forma) ou Nº. */
function resolve(c: Collection, text: string): Species | undefined {
  const t = norm(text).replace(/^#/, '');
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return baseOf(c, Number(t));
  return c.species.find((s) => norm(s.name) === t);
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

export function ExemplarForm({ exemplarId, onDone }: { exemplarId?: string; onDone: (id: string) => void }) {
  const { collection: c, update } = useCollection();
  const original = c.exemplars.find((e) => e.id === exemplarId);
  const originalSp = c.species.find((s) => s.id === original?.speciesId);

  const [pokemon, setPokemon] = useState(originalSp ? baseOf(c, originalSp.dex)?.name ?? originalSp.name : '');
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
  const [newCostume, setNewCostume] = useState({ name: '', shiny: false });
  const [backgroundId, setBackgroundId] = useState(original?.backgroundId ?? '');
  const [newBg, setNewBg] = useState({ name: '', type: 'localidade' as BackgroundType });
  const [eventId, setEventId] = useState(original?.eventId ?? '');
  const [notes, setNotes] = useState(original?.notes ?? '');
  const [error, setError] = useState('');

  const options = useMemo(
    () => [...c.species].sort((a, b) => a.dex - b.dex || (a.form ?? '').localeCompare(b.form ?? '')),
    [c.species],
  );

  function choosePokemon(text: string) {
    setPokemon(text);
    const sp = resolve(c, text);
    setVariationId(sp?.id ?? '');
    setCostumeId('');
  }

  const variation = variationId === NEW ? undefined : c.species.find((s) => s.id === variationId);
  const base = variation ? baseOf(c, variation.dex) : resolve(c, pokemon);
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
      ...(costumeId && costumeId !== NEW ? { costumeId } : {}),
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
  const warnings = draftForWarnings ? exemplarWarnings(c, draftForWarnings).filter((w) => !/sortudo/i.test(w)) : [];

  function submit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    if (!base || (!variation && variationId !== NEW)) return setError('Escolha o Pokémon da lista (nome ou Nº).');
    if (iv === 'erro') return setError('ATK, DEF e PS: cada valor deve ser inteiro de 0 a 15.');
    if (variationId === NEW && !newVariation.trim()) return setError('Informe o nome da nova variação.');
    if (costumeId === NEW && !newCostume.name.trim()) return setError('Informe o nome do traje novo.');
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
        if (costumeId === NEW) {
          next = addCostume(next, speciesId, { name: newCostume.name.trim(), shiny: newCostume.shiny });
          const costume = next.species.find((s) => s.id === speciesId)!.costumes.find((t) => t.name === newCostume.name.trim())!;
          e = { ...e, costumeId: costume.id };
        }
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
        <label className="ef-pokemon">
          Pokémon
          <input
            role="combobox"
            list="pokemon-options"
            value={pokemon}
            placeholder="nome ou Nº"
            onChange={(e) => choosePokemon(e.target.value)}
          />
          <datalist id="pokemon-options">
            {options.map((s) => (
              <option key={s.id} value={s.name}>
                #{s.dex}
              </option>
            ))}
          </datalist>
        </label>
        <div className="ef-auto">
          <Auto label="Nº Pokédex">{sp ? dex4(sp) + (variationId === NEW ? '+' : '') : '----'}</Auto>
          <Auto label="Região">{sp ? regionOf(sp.dex) : '--------'}</Auto>
          <Auto label="ID">
            {preview ? (preview.nickname ? `#${preview.nickname}` : OUT_LABEL[preview.status]) : '#_____'}
          </Auto>
        </div>
      </div>

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
          <option value={NEW}>novo traje…</option>
        </select>
      </label>
      {costumeId === NEW && (
        <>
          <label>Nome do traje novo<input value={newCostume.name} onChange={(e) => setNewCostume({ ...newCostume, name: e.target.value })} /></label>
          <label className="check">
            <input type="checkbox" checked={newCostume.shiny} onChange={(e) => setNewCostume({ ...newCostume, shiny: e.target.checked })} />
            Traje tem brilhante
          </label>
        </>
      )}

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
