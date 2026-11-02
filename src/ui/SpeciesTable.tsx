import { useState, type FormEvent } from 'react';
import { addCostume, addCustomCategory, slugify } from '../core/events';
import { addSpecies, editSpecies, mergeSpeciesTable } from '../core/ops';
import seed from '../data/species.json';
import type { Collection, GenderRule, Species } from '../core/types';
import { useCollection } from './context';

type Flag = 'shiny' | 'mega' | 'dynamax' | 'gigamax';
const FLAGS: [Flag, string][] = [['shiny', 'Brilhante'], ['mega', 'Mega'], ['dynamax', 'Dinamax'], ['gigamax', 'Gigamax']];
const GENDERS: [GenderRule, string][] = [['ambos', 'macho e fêmea'], ['macho', 'só macho'], ['femea', 'só fêmea'], ['sem', 'sem gênero']];

/** Executa uma mudança e devolve a mensagem de erro, se houver. */
function useSafeUpdate() {
  const { update } = useCollection();
  const [error, setError] = useState('');
  const run = (fn: (c: Collection) => Collection): boolean => {
    try {
      update(fn);
      setError('');
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };
  return { run, error };
}

function SpeciesEditor({ sp, onDone }: { sp: Species; onDone: () => void }) {
  const { collection: c } = useCollection();
  const { run, error } = useSafeUpdate();
  const [name, setName] = useState(sp.name);
  const [base, setBase] = useState({ atk: String(sp.base.atk), def: String(sp.base.def), sta: String(sp.base.sta) });
  const [evolvesFrom, setEvolvesFrom] = useState(sp.evolvesFrom ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    const patch: Partial<Species> = {
      name,
      base: { atk: Number(base.atk), def: Number(base.def), sta: Number(base.sta) },
      evolvesFrom: evolvesFrom || undefined,
    };
    if (run((col) => editSpecies(col, sp.id, patch))) onDone();
  }

  return (
    <form aria-label={`Editar ${sp.name}`} className="form inline" onSubmit={submit}>
      <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Ataque base<input inputMode="numeric" value={base.atk} onChange={(e) => setBase({ ...base, atk: e.target.value })} /></label>
      <label>Defesa base<input inputMode="numeric" value={base.def} onChange={(e) => setBase({ ...base, def: e.target.value })} /></label>
      <label>Stamina base<input inputMode="numeric" value={base.sta} onChange={(e) => setBase({ ...base, sta: e.target.value })} /></label>
      <label>
        Evolui de
        <select value={evolvesFrom} onChange={(e) => setEvolvesFrom(e.target.value)}>
          <option value="">—</option>
          {c.species.filter((s) => s.id !== sp.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="primary">Salvar espécie</button>
      <button type="button" onClick={onDone}>Cancelar</button>
    </form>
  );
}

function NewCostumeForm() {
  const { collection: c } = useCollection();
  const { run, error } = useSafeUpdate();
  const [speciesId, setSpeciesId] = useState(c.species[0]?.id ?? '');
  const [name, setName] = useState('');
  const [shiny, setShiny] = useState(false);
  return (
    <form
      aria-label="Novo traje"
      className="form inline"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (name.trim() && run((col) => addCostume(col, speciesId, { name: name.trim(), shiny }))) setName('');
      }}
    >
      <h3>Novo traje</h3>
      <label>
        Espécie
        <select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)}>
          {c.species.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} />Tem brilhante</label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit">Adicionar traje</button>
    </form>
  );
}

const EMPTY_SPECIES = { name: '', dex: '', form: '', evolvesFrom: '', gender: 'ambos' as GenderRule, shiny: true, atk: '', def: '', sta: '' };

function NewSpeciesForm() {
  const { collection: c } = useCollection();
  const { run, error } = useSafeUpdate();
  const [f, setF] = useState(EMPTY_SPECIES);
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  function submit(ev: FormEvent) {
    ev.preventDefault();
    const sp: Species = {
      id: slugify(f.name),
      name: f.name.trim(),
      dex: Number(f.dex),
      ...(f.form.trim() ? { form: f.form.trim().toUpperCase() } : {}),
      ...(f.evolvesFrom ? { evolvesFrom: f.evolvesFrom } : {}),
      gender: f.gender,
      shiny: f.shiny,
      mega: false,
      dynamax: false,
      gigamax: false,
      costumes: [],
      base: { atk: Number(f.atk) || 0, def: Number(f.def) || 0, sta: Number(f.sta) || 0 },
    };
    if (run((col) => addSpecies(col, sp))) setF(EMPTY_SPECIES);
  }

  return (
    <form aria-label="Nova espécie" className="form inline" onSubmit={submit}>
      <h3>Nova espécie</h3>
      <label>Nome<input value={f.name} onChange={(e) => set({ name: e.target.value })} required /></label>
      <label>Nº Pokédex<input inputMode="numeric" value={f.dex} onChange={(e) => set({ dex: e.target.value })} required /></label>
      <label>Forma<input value={f.form} maxLength={1} placeholder="A = Alola" onChange={(e) => set({ form: e.target.value })} /></label>
      <label>
        Evolui de
        <select value={f.evolvesFrom} onChange={(e) => set({ evolvesFrom: e.target.value })}>
          <option value="">—</option>
          {c.species.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label>
        Sexo
        <select value={f.gender} onChange={(e) => set({ gender: e.target.value as GenderRule })}>
          {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={f.shiny} onChange={(e) => set({ shiny: e.target.checked })} />Tem brilhante</label>
      <label>Ataque<input inputMode="numeric" value={f.atk} onChange={(e) => set({ atk: e.target.value })} /></label>
      <label>Defesa<input inputMode="numeric" value={f.def} onChange={(e) => set({ def: e.target.value })} /></label>
      <label>Stamina<input inputMode="numeric" value={f.sta} onChange={(e) => set({ sta: e.target.value })} /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit">Adicionar espécie</button>
    </form>
  );
}

function NewCategoryForm() {
  const { run, error } = useSafeUpdate();
  const [name, setName] = useState('');
  const [values, setValues] = useState('');
  const [species, setSpecies] = useState('');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    const parsed = values
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [n, code] = l.split(':').map((x) => x.trim());
        return { name: n!, code: (code ?? '').toUpperCase() };
      });
    const list = species.trim() ? species.split(',').map((s) => s.trim()).filter(Boolean) : 'todas';
    if (run((col) => addCustomCategory(col, { name: name.trim(), species: list, values: parsed }))) {
      setName('');
      setValues('');
      setSpecies('');
    }
  }

  return (
    <form aria-label="Nova categoria" className="form inline" onSubmit={submit}>
      <h3>Nova categoria de vaga</h3>
      <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>
        Valores (nome:CÓDIGO, um por linha)
        <textarea value={values} onChange={(e) => setValues(e.target.value)} placeholder="Com chapéu:CH" />
      </label>
      <label>Espécies (ids separados por vírgula; vazio = todas)<input value={species} onChange={(e) => setSpecies(e.target.value)} /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit">Criar categoria</button>
    </form>
  );
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PAGE = 100;

export function SpeciesTable() {
  const { collection: c } = useCollection();
  const { run, error } = useSafeUpdate();
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const term = norm(search.trim());
  const matching = [...c.species]
    .sort((a, b) => a.dex - b.dex || a.name.localeCompare(b.name))
    .filter((s) => !term || norm(s.name).includes(term) || String(s.dex) === term.replace(/^0+/, ''));
  const list = matching.slice(0, limit);
  const byId = new Map(c.species.map((s) => [s.id, s]));

  function updateTable() {
    let added = 0;
    const ok = run((col) => {
      const next = mergeSpeciesTable(col, seed as Species[]);
      added = next.species.length - col.species.length;
      return next;
    });
    if (ok) setMessage(`Tabela atualizada: ${added} espécies novas.`);
  }

  return (
    <section>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="toolbar">
        <input type="search" aria-label="Buscar espécie" placeholder="Nome ou Nº" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }} />
        <button type="button" onClick={updateTable}>Atualizar tabela de espécies</button>
      </div>
      {message && <p>{message}</p>}
      <p className="muted">{matching.length} espécie(s)</p>
      <table>
        <thead>
          <tr>
            <th>Nº</th><th>Espécie</th><th>Evolui de</th><th>Sexo</th><th>Marcações</th><th>Trajes</th><th />
          </tr>
        </thead>
        <tbody>
          {list.map((sp) => (
            <tr key={sp.id}>
              <td>{String(sp.dex).padStart(4, '0')}{sp.form ?? ''}</td>
              <th scope="row">{sp.name}</th>
              <td>{sp.evolvesFrom ? byId.get(sp.evolvesFrom)?.name : '—'}</td>
              <td>
                <select aria-label="Sexo" value={sp.gender} onChange={(e) => run((col) => editSpecies(col, sp.id, { gender: e.target.value as GenderRule }))}>
                  {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </td>
              <td className="flags">
                {FLAGS.map(([flag, label]) => (
                  <label key={flag} className="check">
                    <input type="checkbox" checked={sp[flag]} onChange={(e) => run((col) => editSpecies(col, sp.id, { [flag]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </td>
              <td>{sp.costumes.map((t) => t.name + (t.shiny ? ' ✦' : '')).join(', ') || '—'}</td>
              <td>
                <button type="button" onClick={() => setEditing(sp.id)}>Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {matching.length > list.length && (
        <button type="button" onClick={() => setLimit(limit + PAGE)}>Mostrar mais ({matching.length - list.length})</button>
      )}
      {editing && byId.get(editing) && <SpeciesEditor key={editing} sp={byId.get(editing)!} onDone={() => setEditing(null)} />}
      <div className="forms">
        <NewCostumeForm />
        <NewSpeciesForm />
        <NewCategoryForm />
      </div>
    </section>
  );
}
