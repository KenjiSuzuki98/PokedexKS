import { useMemo, useState, type FormEvent } from 'react';
import { registerBackground } from '../core/events';
import { parseIV } from '../core/iv/parse';
import { addExemplar, exemplarWarnings, replaceExemplar } from '../core/ops';
import type { BackgroundType, Exemplar, IV, Origin, Rocket, Sex, Size } from '../core/types';
import { useCollection } from './context';
import { newId, today } from './format';
import { IVCalculator } from './IVCalculator';

const NEW_BG = '__novo';
// Campos opcionais controlados pelo formulário: são limpos e regravados a cada salvar.
const OPTIONAL: (keyof Exemplar)[] = ['cp', 'iv', 'costumeId', 'backgroundId', 'dynamax', 'gigamax', 'eventId', 'notes', 'pendingFields'];

function ivToText(iv?: IV): string {
  if (!iv || iv.estimated) return '';
  return iv.atk === undefined ? `${iv.percent}%` : `${iv.percent}% ${iv.atk}/${iv.def}/${iv.sta}`;
}

export function ExemplarForm({ exemplarId, onDone }: { exemplarId?: string; onDone: (id: string) => void }) {
  const { collection: c, update } = useCollection();
  const original = c.exemplars.find((e) => e.id === exemplarId);
  const sortedSpecies = useMemo(() => [...c.species].sort((a, b) => a.dex - b.dex || a.name.localeCompare(b.name)), [c.species]);

  const [search, setSearch] = useState('');
  const [speciesId, setSpeciesId] = useState(original?.speciesId ?? sortedSpecies[0]?.id ?? '');
  const [cp, setCp] = useState(original?.cp?.toString() ?? '');
  const [ivText, setIvText] = useState(ivToText(original?.iv));
  const [estimated, setEstimated] = useState<IV | null>(original?.iv?.estimated ? original.iv : null);
  const [origin, setOrigin] = useState<Origin>(original?.origin ?? 'capturado');
  const [date, setDate] = useState(original?.date ?? today());
  const [sex, setSex] = useState<Sex | ''>(original?.sex ?? '');
  const [size, setSize] = useState<Size>(original?.size ?? 'normal');
  const [shiny, setShiny] = useState(original?.shiny ?? false);
  const [lucky, setLucky] = useState(original?.lucky ?? false);
  const [rocket, setRocket] = useState<Rocket>(original?.rocket ?? 'normal');
  const [costumeId, setCostumeId] = useState(original?.costumeId ?? '');
  const [backgroundId, setBackgroundId] = useState(original?.backgroundId ?? '');
  const [newBgName, setNewBgName] = useState('');
  const [newBgType, setNewBgType] = useState<BackgroundType>('localidade');
  const [dynamax, setDynamax] = useState(original?.dynamax ?? false);
  const [gigamax, setGigamax] = useState(original?.gigamax ?? false);
  const [eventId, setEventId] = useState(original?.eventId ?? '');
  const [notes, setNotes] = useState(original?.notes ?? '');
  const [showCalc, setShowCalc] = useState(false);
  const [error, setError] = useState('');

  const sp = c.species.find((s) => s.id === speciesId);
  const matching = (term: string) => sortedSpecies.filter((s) => s.name.toLowerCase().includes(term.trim().toLowerCase()));
  const visible = matching(search);

  function changeSearch(term: string) {
    setSearch(term);
    const found = matching(term);
    if (found.length && !found.some((s) => s.id === speciesId)) {
      setSpeciesId(found[0]!.id);
      setCostumeId('');
    }
  }

  function build(): Exemplar | null {
    let iv: IV | undefined;
    if (ivText.trim()) {
      const parsed = parseIV(ivText);
      if (!parsed.ok) {
        setError(parsed.error);
        return null;
      }
      iv = parsed.iv;
    } else if (estimated) iv = estimated;

    const base: Exemplar = { ...(original ?? { id: newId() }) } as Exemplar;
    for (const k of OPTIONAL) delete base[k];
    const fixedSex = sp?.gender === 'macho' || sp?.gender === 'femea' ? sp.gender : null;
    return {
      ...base,
      speciesId,
      ...(cp.trim() ? { cp: Number(cp) } : {}),
      ...(iv ? { iv } : {}),
      origin,
      date,
      sex: sp?.gender === 'ambos' ? sex || null : fixedSex,
      size,
      shiny,
      lucky,
      rocket,
      ...(costumeId ? { costumeId } : {}),
      ...(backgroundId && backgroundId !== NEW_BG ? { backgroundId } : {}),
      ...(dynamax ? { dynamax } : {}),
      ...(gigamax ? { gigamax } : {}),
      ...(eventId ? { eventId } : {}),
      ...(notes.trim() ? { notes } : {}),
    };
  }

  const draft = useMemo(
    () => ({ id: '', speciesId, origin, date, sex: sex || null, size, shiny, lucky, rocket, costumeId: costumeId || null } as Exemplar),
    [speciesId, origin, date, sex, size, shiny, lucky, rocket, costumeId],
  );
  const warnings = sp ? exemplarWarnings(c, draft) : [];

  function submit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    const e = build();
    if (!e) return;
    try {
      update((col) => {
        let next = col;
        let exemplar = e;
        if (backgroundId === NEW_BG) {
          if (!newBgName.trim()) throw new Error('Informe o nome do fundo novo.');
          const r = registerBackground(next, { name: newBgName.trim(), type: newBgType, speciesId });
          next = r.collection;
          exemplar = { ...e, backgroundId: r.background.id };
        }
        return original ? replaceExemplar(next, exemplar) : addExemplar(next, exemplar);
      });
      onDone(e.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const modifier = lucky ? 'sortudo' : rocket === 'normal' ? 'normal' : rocket;
  const backgrounds = c.backgrounds.filter((b) => b.species === 'todas' || b.species.includes(speciesId) || b.id === backgroundId);

  return (
    <form className="form" onSubmit={submit}>
      {original?.pendingFields?.length ? <p className="warn">Faltam completar: {original.pendingFields.join(', ')}</p> : null}
      <label>Buscar espécie<input value={search} onChange={(e) => changeSearch(e.target.value)} /></label>
      <label>
        Espécie
        <select value={speciesId} onChange={(e) => { setSpeciesId(e.target.value); setCostumeId(''); }}>
          {visible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label>CP<input inputMode="numeric" value={cp} onChange={(e) => setCp(e.target.value)} /></label>
      <label>
        IV
        <input value={ivText} placeholder="ex.: 96% 15/14/14" onChange={(e) => { setIvText(e.target.value); setEstimated(null); }} />
      </label>
      {estimated && !ivText && <p className="muted">IV estimado: ~{Math.round(estimated.percent)}%</p>}
      <button type="button" className="link" onClick={() => setShowCalc(!showCalc)}>Calcular IV</button>
      {showCalc && sp && (
        <IVCalculator
          base={sp.base}
          cp={cp.trim() ? Number(cp) : null}
          modifier={modifier}
          onUse={(iv) => {
            if (iv.estimated) {
              setEstimated(iv);
              setIvText('');
            } else {
              setEstimated(null);
              setIvText(ivToText(iv));
            }
            setShowCalc(false);
          }}
        />
      )}
      <label>
        Origem
        <select value={origin} onChange={(e) => setOrigin(e.target.value as Origin)}>
          <option value="capturado">capturado</option>
          <option value="troca">troca</option>
        </select>
      </label>
      <label>Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      {sp?.gender === 'ambos' && (
        <label>
          Sexo
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')}>
            <option value="">—</option>
            <option value="macho">macho</option>
            <option value="femea">fêmea</option>
          </select>
        </label>
      )}
      <label>
        Tamanho
        <select value={size} onChange={(e) => setSize(e.target.value as Size)}>
          <option value="normal">normal</option>
          <option value="xxl">XXL</option>
          <option value="xxs">XXS</option>
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} />Brilhante</label>
      <label className="check"><input type="checkbox" checked={lucky} onChange={(e) => setLucky(e.target.checked)} />Sortudo</label>
      <label>
        Rocket
        <select value={rocket} onChange={(e) => setRocket(e.target.value as Rocket)}>
          <option value="normal">normal</option>
          <option value="sombroso">sombroso</option>
          <option value="purificado">purificado</option>
        </select>
      </label>
      <label>
        Traje
        <select value={costumeId} onChange={(e) => setCostumeId(e.target.value)}>
          <option value="">sem traje</option>
          {sp?.costumes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label>
        Fundo
        <select value={backgroundId} onChange={(e) => setBackgroundId(e.target.value)}>
          <option value="">sem fundo</option>
          {backgrounds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          <option value={NEW_BG}>novo fundo…</option>
        </select>
      </label>
      {backgroundId === NEW_BG && (
        <>
          <label>Nome do fundo novo<input value={newBgName} onChange={(e) => setNewBgName(e.target.value)} /></label>
          <label>
            Tipo do fundo
            <select value={newBgType} onChange={(e) => setNewBgType(e.target.value as BackgroundType)}>
              <option value="localidade">localidade</option>
              <option value="especial">especial</option>
              <option value="aventura">efeito de aventura</option>
            </select>
          </label>
        </>
      )}
      {sp?.dynamax && <label className="check"><input type="checkbox" checked={dynamax} onChange={(e) => setDynamax(e.target.checked)} />Dinamax</label>}
      {sp?.gigamax && <label className="check"><input type="checkbox" checked={gigamax} onChange={(e) => setGigamax(e.target.checked)} />Gigamax</label>}
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
