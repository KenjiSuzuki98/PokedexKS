import { useMemo } from 'react';
import { chainRoot, speciesMap } from '../core/chain';
import { acknowledgeOpenedSlots } from '../core/ops';
import { computeProgress } from '../core/progress';
import { useCollection } from './context';
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

export function CollectionProgress() {
  const { collection: c, result: r, update } = useCollection();
  const p = useMemo(() => computeProgress(c, r), [c, r]);
  const byId = speciesMap(c);
  const chains = useMemo(() => {
    const groups = new Map<string, typeof c.species>();
    for (const sp of [...c.species].sort((a, b) => a.dex - b.dex)) {
      const root = chainRoot(sp, byId).id;
      groups.set(root, [...(groups.get(root) ?? []), sp]);
    }
    return [...groups.entries()].sort((a, b) => byId.get(a[0])!.dex - byId.get(b[0])!.dex);
  }, [c.species, byId]);

  const opened = (c.openedSlots ?? []).map((id) => r.slots.find((s) => s.id === id)).filter((s) => s !== undefined);
  const categoryName = (id: string) => CATEGORY_LABELS[id] ?? c.customCategories.find((x) => x.id === id)?.name ?? id;

  return (
    <section>
      {opened.length > 0 && (
        <section aria-label="Novas vagas abertas" className="opened">
          <h3>Novas vagas abertas ({opened.length})</h3>
          <ul>
            {opened.map((s) => (
              <li key={s.id}>
                <code>{s.id}</code> {s.label}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => update((col) => acknowledgeOpenedSlots(col))}>Marcar como vistas</button>
        </section>
      )}

      <Gauge label="Geral" p={p.overall} size="lg" />

      <h3>Por categoria</h3>
      <div className="gauges">
        {Object.entries(p.byCategory).map(([id, prog]) => <Gauge key={id} label={categoryName(id)} p={prog} />)}
      </div>

      <h3>Por cadeia</h3>
      {chains.map(([rootId, members]) => (
        <div key={rootId} className="chain">
          <Gauge label={`Cadeia ${byId.get(rootId)!.name}`} p={p.byChain[rootId]!} />
          <div className="gauges">
            {[...members]
              .sort((a, b) => (a.id === rootId ? -1 : b.id === rootId ? 1 : a.dex - b.dex))
              .map((sp) => <Gauge key={sp.id} label={sp.name} p={p.bySpecies[sp.id]!} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
