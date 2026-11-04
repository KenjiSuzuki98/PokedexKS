import { useMemo, useState } from 'react';
import { chainRoot, depth, speciesMap } from '../core/chain';
import { acknowledgeOpenedSlots } from '../core/ops';
import { computeProgress } from '../core/progress';
import { slotsInScope, type Scope } from '../core/scope';
import type { Species } from '../core/types';
import { useCollection } from './context';
import { formatIV, speciesName } from './format';
import { Gauge } from './Gauge';

const CATEGORY_LABELS: Record<string, string> = {
  evolucao: 'Evolução',
  potencial: 'Formas (Mega/Dinamax/Gigamax)',
  rocket: 'Rocket',
  troca: 'Troca',
  raridade: 'Raridade',
  traje: 'Traje',
  fundo: 'Fundo',
  tamanho: 'Tamanho',
  sexo: 'Sexo',
};
const PAGE = 60;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type View =
  | { kind: 'home' }
  | { kind: 'chain'; rootId: string }
  | { kind: 'slots'; scope: Scope; title: string; back: View };

function SlotList({ scope, onOpenExemplar }: { scope: Scope; onOpenExemplar: (id: string) => void }) {
  const { collection: c, result: r } = useCollection();
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [limit, setLimit] = useState(100);
  const rows = useMemo(() => slotsInScope(c, r, scope), [c, r, scope]);
  const shown = onlyMissing ? rows.filter((x) => !x.occupantId) : rows;

  return (
    <>
      <label className="check">
        <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
        Só o que falta
      </label>
      <table className="slots">
        <thead>
          <tr><th>ID</th><th>Vaga</th><th>Quem ocupa</th></tr>
        </thead>
        <tbody>
          {shown.slice(0, limit).map(({ slot, occupantId, reserved }) => {
            const e = occupantId ? c.exemplars.find((x) => x.id === occupantId) : undefined;
            return (
              <tr key={slot.id} className={e ? '' : 'missing'}>
                <td><code>{slot.id}</code></td>
                <td>{slot.label}</td>
                <td>
                  {e ? (
                    <>
                      {reserved && <span className="muted">reservado: </span>}
                      <button type="button" className="link" onClick={() => onOpenExemplar(e.id)}>
                        {speciesName(c, e.speciesId)} {formatIV(e)}
                      </button>
                    </>
                  ) : (
                    <span className="muted">falta</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shown.length > limit && (
        <button type="button" onClick={() => setLimit(limit + 100)}>Mostrar mais ({shown.length - limit})</button>
      )}
    </>
  );
}

export function CollectionProgress({ onOpenExemplar }: { onOpenExemplar: (id: string) => void }) {
  const { collection: c, result: r, update } = useCollection();
  const [view, setView] = useState<View>({ kind: 'home' });
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const p = useMemo(() => computeProgress(c, r), [c, r]);
  const byId = useMemo(() => speciesMap(c), [c]);

  const chains = useMemo(() => {
    const groups = new Map<string, Species[]>();
    for (const sp of c.species) {
      const root = chainRoot(sp, byId).id;
      groups.set(root, [...(groups.get(root) ?? []), sp]);
    }
    for (const members of groups.values()) members.sort((a, b) => depth(a, byId) - depth(b, byId) || a.dex - b.dex);
    return [...groups.entries()].sort((a, b) => byId.get(a[0])!.dex - byId.get(b[0])!.dex);
  }, [c.species, byId]);

  const categoryName = (id: string) => CATEGORY_LABELS[id] ?? c.customCategories.find((x) => x.id === id)?.name ?? id;
  const card = (label: string, prog: (typeof p)['overall'], onClick: () => void) => (
    <button
      key={label}
      type="button"
      className="card"
      aria-label={`${label}: ${Math.round(prog.percent)}% ${prog.filled}/${prog.total}`}
      onClick={onClick}
    >
      <Gauge label={label} p={prog} />
    </button>
  );
  const back = (to: View) => (
    <button type="button" className="link" onClick={() => setView(to)}>← voltar</button>
  );

  if (view.kind === 'slots') {
    return (
      <section>
        {back(view.back)}
        <h3>{view.title}</h3>
        <SlotList scope={view.scope} onOpenExemplar={onOpenExemplar} />
      </section>
    );
  }

  if (view.kind === 'chain') {
    const members = chains.find(([root]) => root === view.rootId)?.[1] ?? [];
    const title = `Cadeia ${byId.get(view.rootId)?.name ?? view.rootId}`;
    return (
      <section>
        {back({ kind: 'home' })}
        <div className="cards">
          {card(title, p.byChain[view.rootId]!, () =>
            setView({ kind: 'slots', scope: { kind: 'chain', rootId: view.rootId }, title, back: view }),
          )}
          {members.map((sp) =>
            card(sp.name, p.bySpecies[sp.id]!, () =>
              setView({ kind: 'slots', scope: { kind: 'species', speciesId: sp.id }, title: sp.name, back: view }),
            ),
          )}
        </div>
      </section>
    );
  }

  const opened = (c.openedSlots ?? []).map((id) => r.slots.find((s) => s.id === id)).filter((s) => s !== undefined);
  const term = norm(search.trim());
  const visibleChains = chains.filter(
    ([, members]) => !term || members.some((s) => norm(s.name).includes(term) || String(s.dex) === term.replace(/^0+/, '')),
  );
  const home: View = { kind: 'home' };

  return (
    <section>
      {opened.length > 0 && (
        <section aria-label="Novas vagas abertas" className="opened">
          <h3>Novas vagas abertas ({opened.length})</h3>
          <ul>
            {opened.slice(0, 50).map((s) => (
              <li key={s.id}>
                <code>{s.id}</code> {s.label}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => update((col) => acknowledgeOpenedSlots(col))}>Marcar como vistas</button>
        </section>
      )}

      <div className="cards">
        {card('Geral', p.overall, () => setView({ kind: 'slots', scope: { kind: 'all' }, title: 'Geral', back: home }))}
      </div>

      <h3>Por categoria</h3>
      <div className="cards">
        {Object.entries(p.byCategory).map(([id, prog]) =>
          card(categoryName(id), prog, () =>
            setView({ kind: 'slots', scope: { kind: 'category', category: id }, title: categoryName(id), back: home }),
          ),
        )}
      </div>

      <h3>Por cadeia</h3>
      <input
        type="search"
        aria-label="Buscar cadeia"
        placeholder="Buscar por nome ou Nº"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setLimit(PAGE);
        }}
      />
      <div className="cards">
        {visibleChains.slice(0, limit).map(([rootId]) =>
          card(`Cadeia ${byId.get(rootId)!.name}`, p.byChain[rootId]!, () => setView({ kind: 'chain', rootId })),
        )}
      </div>
      {visibleChains.length > limit && (
        <button type="button" onClick={() => setLimit(limit + PAGE)}>Mostrar mais ({visibleChains.length - limit})</button>
      )}
    </section>
  );
}
