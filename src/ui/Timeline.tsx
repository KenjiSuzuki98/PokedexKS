import { useMemo, useState, type FormEvent } from 'react';
import { activateEvent, addEvent } from '../core/events';
import { timeline } from '../core/progress';
import type { BackgroundType, EventBrings, GameEvent, PotentialForm } from '../core/types';
import { useCollection } from './context';
import { newId, speciesName } from './format';

const FORM_LABELS: Record<PotentialForm, string> = { mega: 'Mega', dynamax: 'Dinamax', gigamax: 'Gigamax' };

function describe(b: EventBrings, name: (id: string) => string): string[] {
  return [
    ...(b.costumes ?? []).map((t) => `Traje ${name(t.speciesId)}: ${t.name}${t.shiny ? ' (com brilhante)' : ''}`),
    ...(b.backgrounds ?? []).map((g) => `Fundo ${g.name} (${g.type}) para ${g.species === 'todas' ? 'todas' : g.species.map(name).join(', ')}`),
    ...(b.shinyDebuts ?? []).map((id) => `Estreia de brilhante: ${name(id)}`),
    ...(b.forms ?? []).map((f) => `${FORM_LABELS[f.form]}: ${name(f.speciesId)}`),
  ];
}

function NewEventForm() {
  const { collection: c, update } = useCollection();
  const first = c.species[0]?.id ?? '';
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [description, setDescription] = useState('');
  const [brings, setBrings] = useState<Required<Pick<EventBrings, 'costumes' | 'backgrounds' | 'shinyDebuts' | 'forms'>>>({
    costumes: [], backgrounds: [], shinyDebuts: [], forms: [],
  });
  const [costume, setCostume] = useState({ speciesId: first, name: '', shiny: false });
  const [bg, setBg] = useState({ name: '', type: 'localidade' as BackgroundType, species: '' });
  const [debut, setDebut] = useState(first);
  const [form, setForm] = useState({ speciesId: first, form: 'mega' as PotentialForm });
  const [activate, setActivate] = useState(false);
  const [error, setError] = useState('');
  const name_ = (id: string) => speciesName(c, id);

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim() || !start) {
      setError('Informe nome e data de início.');
      return;
    }
    const event: GameEvent = { id: newId(), name: name.trim(), start, end: end || start, description, active: false, brings };
    try {
      update((col) => {
        const next = addEvent(col, event);
        return activate ? activateEvent(next, event.id).collection : next;
      });
      setName(''); setStart(''); setEnd(''); setDescription(''); setActivate(false); setError('');
      setBrings({ costumes: [], backgrounds: [], shinyDebuts: [], forms: [] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const speciesOptions = c.species.map((s) => <option key={s.id} value={s.id}>{s.name}</option>);

  return (
    <form aria-label="Novo evento" className="form inline" onSubmit={submit}>
      <h3>Novo evento</h3>
      <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Início<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <label>Fim<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      <label>Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>

      <fieldset>
        <legend>Traje novo</legend>
        <label>Espécie do traje<select value={costume.speciesId} onChange={(e) => setCostume({ ...costume, speciesId: e.target.value })}>{speciesOptions}</select></label>
        <label>Nome do traje<input value={costume.name} onChange={(e) => setCostume({ ...costume, name: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={costume.shiny} onChange={(e) => setCostume({ ...costume, shiny: e.target.checked })} />Traje tem brilhante</label>
        <button type="button" onClick={() => {
          if (!costume.name.trim()) return;
          setBrings({ ...brings, costumes: [...brings.costumes, { ...costume, name: costume.name.trim() }] });
          setCostume({ ...costume, name: '', shiny: false });
        }}>Incluir traje</button>
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
        <label>Espécies do fundo (ids por vírgula; vazio = todas)<input value={bg.species} onChange={(e) => setBg({ ...bg, species: e.target.value })} /></label>
        <button type="button" onClick={() => {
          if (!bg.name.trim()) return;
          const species = bg.species.trim() ? bg.species.split(',').map((s) => s.trim()).filter(Boolean) : 'todas';
          setBrings({ ...brings, backgrounds: [...brings.backgrounds, { name: bg.name.trim(), type: bg.type, species }] });
          setBg({ name: '', type: 'localidade', species: '' });
        }}>Incluir fundo</button>
      </fieldset>

      <fieldset>
        <legend>Estreia de brilhante</legend>
        <label>Estreia de brilhante<select value={debut} onChange={(e) => setDebut(e.target.value)}>{speciesOptions}</select></label>
        <button type="button" onClick={() => setBrings({ ...brings, shinyDebuts: [...brings.shinyDebuts, debut] })}>Incluir estreia</button>
      </fieldset>

      <fieldset>
        <legend>Forma nova</legend>
        <label>Espécie da forma<select value={form.speciesId} onChange={(e) => setForm({ ...form, speciesId: e.target.value })}>{speciesOptions}</select></label>
        <label>
          Forma
          <select value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value as PotentialForm })}>
            {(Object.keys(FORM_LABELS) as PotentialForm[]).map((f) => <option key={f} value={f}>{FORM_LABELS[f]}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setBrings({ ...brings, forms: [...brings.forms, form] })}>Incluir forma</button>
      </fieldset>

      {describe(brings, name_).length > 0 && (
        <ul>{describe(brings, name_).map((d, i) => <li key={i}>{d}</li>)}</ul>
      )}
      <label className="check"><input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />Ativar agora</label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="primary">Cadastrar evento</button>
    </form>
  );
}

export function Timeline() {
  const { collection: c, result: r, update } = useCollection();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const entries = useMemo(() => timeline(c, r, { from: from || undefined, to: to || undefined }), [c, r, from, to]);
  const name = (id: string) => speciesName(c, id);

  return (
    <section>
      <div className="toolbar">
        <label>De<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Até<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {entries.length === 0 && <p className="muted">Nenhum evento no período.</p>}
      {entries.map(({ event, opened, filled, missing }) => (
        <article key={event.id} aria-label={event.name} className="event">
          <h3>{event.name}</h3>
          <p className="muted">
            {event.start}{event.end !== event.start ? ` a ${event.end}` : ''} · {event.active ? 'ativo' : 'não ativado'}
          </p>
          {event.description && <p>{event.description}</p>}
          <ul>{describe(event.brings, name).map((d, i) => <li key={i}>{d}</li>)}</ul>
          {event.active ? (
            <p>{opened} vagas abertas, {filled} preenchidas, faltam {missing}</p>
          ) : (
            <button type="button" onClick={() => update((col) => activateEvent(col, event.id).collection)}>Ativar</button>
          )}
        </article>
      ))}
      <NewEventForm />
    </section>
  );
}
