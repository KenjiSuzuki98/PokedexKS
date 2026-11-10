import { useMemo, useState, type FormEvent } from 'react';
import {
  activateEvent, addEvent, costumeEntries, deleteEvent, editCostume, removeCostume, sameNameCostume, slugify, updateEvent,
} from '../core/events';
import { timeline } from '../core/progress';
import type { BackgroundType, Collection, EventBrings, GameEvent, PotentialForm } from '../core/types';
import { useCollection } from './context';
import { newId, speciesName } from './format';
import { SpeciesPicker } from './SpeciesPicker';

const FORM_LABELS: Record<PotentialForm, string> = { mega: 'Mega', dynamax: 'Dinamax', gigamax: 'Gigamax' };
type Costumes = NonNullable<EventBrings['costumes']>;
type Draft = Required<Pick<EventBrings, 'costumes' | 'backgrounds' | 'shinyDebuts' | 'forms'>> & Pick<EventBrings, 'categories'>;

const costumeLabel = (t: Costumes[number], name: (id: string) => string) =>
  `Traje ${name(t.speciesId)}: ${t.name}${t.shiny ? ' (com brilhante)' : ''}`;

function describe(b: EventBrings, name: (id: string) => string): string[] {
  return [
    ...(b.costumes ?? []).map((t) => costumeLabel(t, name)),
    ...(b.backgrounds ?? []).map((g) => `Fundo ${g.name} (${g.type}) para ${g.species === 'todas' ? 'todas' : g.species.map(name).join(', ')}`),
    ...(b.shinyDebuts ?? []).map((id) => `Estreia de brilhante: ${name(id)}`),
    ...(b.forms ?? []).map((f) => `${FORM_LABELS[f.form]}: ${name(f.speciesId)}`),
  ];
}

/** Em qual evento a espécie ganhou este traje (para o aviso de duplicado). */
function costumeOrigin(c: Collection, speciesId: string, costumeId: string): string {
  const ev = c.events.find((e) => e.brings.costumes?.some((t) => t.speciesId === speciesId && t.costumeId === costumeId));
  return ev ? `evento ${ev.name}` : 'sem evento';
}

function toDraft(b: EventBrings = {}): Draft {
  return {
    costumes: b.costumes ?? [],
    backgrounds: b.backgrounds ?? [],
    shinyDebuts: b.shinyDebuts ?? [],
    forms: b.forms ?? [],
    ...(b.categories ? { categories: b.categories } : {}),
  };
}

/** Formulário de evento: cadastro novo ou edição de um existente. */
function EventForm({ initial, onDone }: { initial?: GameEvent; onDone?: () => void }) {
  const { collection: c, update } = useCollection();
  const [name, setName] = useState(initial?.name ?? '');
  const [start, setStart] = useState(initial?.start ?? '');
  const [end, setEnd] = useState(initial?.end ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [brings, setBrings] = useState<Draft>(toDraft(initial?.brings));
  const [costume, setCostume] = useState({ speciesId: '', name: '', shiny: false, evolutions: true });
  const [bg, setBg] = useState({ name: '', type: 'localidade' as BackgroundType, species: [] as string[], pick: '' });
  const [debut, setDebut] = useState('');
  const [form, setForm] = useState({ speciesId: '', form: 'mega' as PotentialForm });
  const [activate, setActivate] = useState(false);
  const [error, setError] = useState('');
  const name_ = (id: string) => speciesName(c, id);
  const mine = new Set((initial?.brings.costumes ?? []).map((t) => `${t.speciesId}|${t.costumeId}`));

  function includeCostume() {
    setError('');
    if (!costume.speciesId) return setError('Escolha a espécie do traje.');
    if (!costume.name.trim()) return setError('Informe o nome do traje.');
    const entries = costumeEntries(c, { speciesId: costume.speciesId, name: costume.name.trim(), shiny: costume.shiny }, costume.evolutions);
    const problems: string[] = [];
    const added: Costumes = [];
    for (const t of entries) {
      if (brings.costumes.some((x) => x.speciesId === t.speciesId && slugify(x.name) === slugify(t.name))) continue;
      const existing = sameNameCostume(c, t.speciesId, t.name);
      if (existing && !mine.has(`${t.speciesId}|${existing.id}`)) {
        problems.push(`${name_(t.speciesId)} já tem o traje ${existing.name} (${costumeOrigin(c, t.speciesId, existing.id)}).`);
        continue;
      }
      added.push(t);
    }
    setBrings({ ...brings, costumes: [...brings.costumes, ...added] });
    if (problems.length) setError(problems.join(' '));
    setCostume({ ...costume, name: '', shiny: false });
  }

  function editCostumeDraft(costumeId: string | undefined, speciesId: string, patch: Partial<Costumes[number]>) {
    // O mesmo traje (mesmo id) muda junto em toda a cadeia.
    setBrings({
      ...brings,
      costumes: brings.costumes.map((t) => ((costumeId ? t.costumeId === costumeId : t.speciesId === speciesId) ? { ...t, ...patch } : t)),
    });
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim() || !start) return setError('Informe nome e data de início.');
    const event: GameEvent = {
      id: initial?.id ?? newId(),
      name: name.trim(),
      start,
      end: end || start,
      description,
      active: initial?.active ?? false,
      brings,
    };
    try {
      update((col) => {
        if (initial) return updateEvent(col, event);
        const next = addEvent(col, event);
        return activate ? activateEvent(next, event.id).collection : next;
      });
      setError('');
      if (initial) onDone?.();
      else {
        setName(''); setStart(''); setEnd(''); setDescription(''); setActivate(false);
        setBrings(toDraft());
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const remove = (key: keyof Draft, i: number) => setBrings({ ...brings, [key]: (brings[key] as unknown[]).filter((_, j) => j !== i) });
  const others = [
    ...brings.backgrounds.map((g, i) => [describe({ backgrounds: [g] }, name_)[0]!, () => remove('backgrounds', i)] as const),
    ...brings.shinyDebuts.map((id, i) => [describe({ shinyDebuts: [id] }, name_)[0]!, () => remove('shinyDebuts', i)] as const),
    ...brings.forms.map((f, i) => [describe({ forms: [f] }, name_)[0]!, () => remove('forms', i)] as const),
  ];

  return (
    <form aria-label={initial ? `Editar ${initial.name}` : 'Novo evento'} className="form inline" onSubmit={submit}>
      <h3>{initial ? `Editar ${initial.name}` : 'Novo evento'}</h3>
      <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Início<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <label>Fim<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      <label>Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>

      <fieldset>
        <legend>Traje novo</legend>
        <div className="field">
          <span>Espécie do traje</span>
          <SpeciesPicker label="Espécie do traje" value={costume.speciesId} onChange={(id) => setCostume({ ...costume, speciesId: id })} />
        </div>
        <label>Nome do traje<input value={costume.name} onChange={(e) => setCostume({ ...costume, name: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={costume.shiny} onChange={(e) => setCostume({ ...costume, shiny: e.target.checked })} />Traje tem brilhante</label>
        <label className="check"><input type="checkbox" checked={costume.evolutions} onChange={(e) => setCostume({ ...costume, evolutions: e.target.checked })} />Também nas evoluções</label>
        <button type="button" onClick={includeCostume}>Incluir traje</button>
      </fieldset>

      <fieldset>
        <legend>Fundo novo</legend>
        <label>Nome do fundo<input value={bg.name} onChange={(e) => setBg({ ...bg, name: e.target.value })} /></label>
        <label>
          Tipo do fundo
          <select value={bg.type} onChange={(e) => setBg({ ...bg, type: e.target.value as BackgroundType })}>
            <option value="localidade">localidade</option>
            <option value="especial">especial</option>
            <option value="aventura">efeito de aventura</option>
          </select>
        </label>
        <div className="field">
          <span>Espécies do fundo (nenhuma = todas)</span>
          <SpeciesPicker label="Espécie do fundo" value={bg.pick} onChange={(id) => setBg({ ...bg, pick: id })} />
          <button type="button" disabled={!bg.pick} onClick={() => setBg({ ...bg, species: [...new Set([...bg.species, bg.pick])], pick: '' })}>
            Adicionar espécie ao fundo
          </button>
          {bg.species.length > 0 && <p className="muted">{bg.species.map(name_).join(', ')}</p>}
        </div>
        <button type="button" onClick={() => {
          if (!bg.name.trim()) return;
          const species = bg.species.length ? bg.species : 'todas';
          setBrings({ ...brings, backgrounds: [...brings.backgrounds, { name: bg.name.trim(), type: bg.type, species }] });
          setBg({ name: '', type: 'localidade', species: [], pick: '' });
        }}>Incluir fundo</button>
      </fieldset>

      <fieldset>
        <legend>Estreia de brilhante</legend>
        <div className="field">
          <span>Estreia de brilhante</span>
          <SpeciesPicker label="Estreia de brilhante" value={debut} onChange={setDebut} />
        </div>
        <button type="button" disabled={!debut} onClick={() => setBrings({ ...brings, shinyDebuts: [...new Set([...brings.shinyDebuts, debut])] })}>
          Incluir estreia
        </button>
      </fieldset>

      <fieldset>
        <legend>Forma nova</legend>
        <div className="field">
          <span>Espécie da forma</span>
          <SpeciesPicker label="Espécie da forma" value={form.speciesId} onChange={(id) => setForm({ ...form, speciesId: id })} />
        </div>
        <label>
          Forma
          <select value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value as PotentialForm })}>
            {(Object.keys(FORM_LABELS) as PotentialForm[]).map((f) => <option key={f} value={f}>{FORM_LABELS[f]}</option>)}
          </select>
        </label>
        <button type="button" disabled={!form.speciesId} onClick={() => setBrings({ ...brings, forms: [...brings.forms, form] })}>Incluir forma</button>
      </fieldset>

      {(brings.costumes.length > 0 || others.length > 0) && (
        <ul className="brings">
          {brings.costumes.map((t, i) => (
            <li key={`c${i}`}>
              <span>{costumeLabel(t, name_)}</span>
              <input
                aria-label={`Nome do traje de ${name_(t.speciesId)}`}
                value={t.name}
                onChange={(e) => editCostumeDraft(t.costumeId, t.speciesId, { name: e.target.value })}
              />
              <label className="check">
                <input type="checkbox" checked={t.shiny} onChange={(e) => editCostumeDraft(t.costumeId, t.speciesId, { shiny: e.target.checked })} />
                brilhante
              </label>
              <button type="button" aria-label={`Tirar ${costumeLabel(t, name_)}`} onClick={() => remove('costumes', i)}>✕</button>
            </li>
          ))}
          {others.map(([label, onRemove], i) => (
            <li key={`o${i}`}>
              <span>{label}</span>
              <button type="button" aria-label={`Tirar ${label}`} onClick={onRemove}>✕</button>
            </li>
          ))}
        </ul>
      )}
      {!initial && (
        <label className="check"><input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />Ativar agora</label>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="primary">{initial ? 'Salvar evento' : 'Cadastrar evento'}</button>
      {initial && <button type="button" onClick={onDone}>Cancelar</button>}
    </form>
  );
}

function EventCard({ entry }: { entry: ReturnType<typeof timeline>[number] }) {
  const { collection: c, update } = useCollection();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const { event, opened, filled, missing } = entry;
  const name = (id: string) => speciesName(c, id);

  const run = (fn: (col: Collection) => Collection) => {
    try {
      update(fn);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (editing) return <EventForm initial={event} onDone={() => setEditing(false)} />;

  return (
    <article aria-label={event.name} className="event">
      <h3>{event.name}</h3>
      <p className="muted">
        {event.start}{event.end !== event.start ? ` a ${event.end}` : ''} · {event.active ? 'ativo' : 'não ativado'}
      </p>
      {event.description && <p>{event.description}</p>}
      <ul>{describe(event.brings, name).map((d, i) => <li key={i}>{d}</li>)}</ul>
      {event.active ? (
        <p>{opened} vagas abertas, {filled} preenchidas, faltam {missing}</p>
      ) : (
        <button type="button" onClick={() => run((col) => activateEvent(col, event.id).collection)}>Ativar</button>
      )}
      <button type="button" onClick={() => setEditing(true)}>Editar</button>
      {confirming ? (
        <>
          <button type="button" className="danger" onClick={() => run((col) => deleteEvent(col, event.id))}>Confirmar exclusão</button>
          <button type="button" onClick={() => setConfirming(false)}>Cancelar</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>Excluir</button>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </article>
  );
}

/** Trajes que não vieram de nenhum evento (antigos, mantidos porque estão em uso). */
function LooseCostumes() {
  const { collection: c, update } = useCollection();
  const [drafts, setDrafts] = useState<Record<string, { name: string; shiny: boolean }>>({});
  const [error, setError] = useState('');
  const linked = new Set(c.events.flatMap((e) => (e.brings.costumes ?? []).map((t) => `${t.speciesId}|${t.costumeId}`)));
  const loose = c.species.flatMap((sp) =>
    sp.costumes.filter((t) => !t.since?.eventId && !linked.has(`${sp.id}|${t.id}`)).map((t) => ({ sp, t, key: `${sp.id}|${t.id}` })),
  );
  if (loose.length === 0) return null;

  const run = (fn: (col: Collection) => Collection) => {
    try {
      update(fn);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section aria-label="Trajes sem evento" className="loose">
      <h3>Trajes sem evento</h3>
      <p className="muted">Trajes antigos que algum exemplar seu usa. Edite ou remova quando não precisar mais.</p>
      <ul>
        {loose.map(({ sp, t, key }) => {
          const d = drafts[key] ?? { name: t.name, shiny: t.shiny };
          const label = `${t.name} (${sp.name})`;
          return (
            <li key={key}>
              <input aria-label={`Nome do traje ${label}`} value={d.name} onChange={(e) => setDrafts({ ...drafts, [key]: { ...d, name: e.target.value } })} />
              <label className="check">
                <input type="checkbox" checked={d.shiny} onChange={(e) => setDrafts({ ...drafts, [key]: { ...d, shiny: e.target.checked } })} />
                brilhante
              </label>
              <button type="button" aria-label={`Salvar traje ${label}`} disabled={!d.name.trim()} onClick={() => run((col) => editCostume(col, t.id, { name: d.name.trim(), shiny: d.shiny }))}>
                Salvar
              </button>
              <button type="button" aria-label={`Remover traje ${label}`} onClick={() => run((col) => removeCostume(col, t.id, sp.id))}>
                Remover
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}

export function Timeline() {
  const { collection: c, result: r } = useCollection();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const entries = useMemo(() => timeline(c, r, { from: from || undefined, to: to || undefined }), [c, r, from, to]);

  return (
    <section>
      <div className="toolbar">
        <label>De<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Até<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {entries.length === 0 && <p className="muted">Nenhum evento no período.</p>}
      {entries.map((entry) => <EventCard key={entry.event.id} entry={entry} />)}
      <EventForm />
      <LooseCostumes />
    </section>
  );
}
