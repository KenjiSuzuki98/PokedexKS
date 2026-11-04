import { useCallback, useEffect, useState } from 'react';
import type { Collection } from '../core/types';
import type { Store } from '../storage/store';
import { CollectionProgress } from './CollectionProgress';
import { CollectionProvider, useCollection } from './context';
import { DataPanel } from './DataPanel';
import { ExemplarDetail } from './ExemplarDetail';
import { ExemplarForm } from './ExemplarForm';
import { ExemplarList } from './ExemplarList';
import { RenamePending } from './RenamePending';
import { SpeciesTable } from './SpeciesTable';
import { Timeline } from './Timeline';

const TABS = ['Coleção', 'Meus Pokémon', 'Renomeações', 'Espécies', 'Linha do tempo', 'Dados'] as const;
type Tab = (typeof TABS)[number];

type View = { kind: 'tab' } | { kind: 'detail'; id: string } | { kind: 'new' };

function Shell() {
  const { result } = useCollection();
  const [tab, setTab] = useState<Tab>('Coleção');
  const [view, setView] = useState<View>({ kind: 'tab' });
  const open = (id: string) => setView({ kind: 'detail', id });
  const pending = result.renamePending.length;
  const label = (t: Tab) => (t === 'Renomeações' && pending ? `${t} (${pending})` : t);

  let body;
  if (view.kind === 'detail') body = <ExemplarDetail id={view.id} onClose={() => setView({ kind: 'tab' })} />;
  else if (view.kind === 'new')
    body = (
      <section>
        <h2>Novo exemplar</h2>
        <ExemplarForm onDone={open} />
      </section>
    );
  else
    body = (
      <section>
        <h2>{tab}</h2>
        {tab === 'Meus Pokémon' && <ExemplarList onOpen={open} />}
        {tab === 'Coleção' && <CollectionProgress onOpenExemplar={open} />}
        {tab === 'Renomeações' && <RenamePending onOpen={open} />}
        {tab === 'Espécies' && <SpeciesTable />}
        {tab === 'Linha do tempo' && <Timeline />}
        {tab === 'Dados' && <DataPanel />}
      </section>
    );

  return (
    <div className="app">
      <header>
        <h1>Pokédex KS</h1>
        <button type="button" className="primary" onClick={() => setView({ kind: 'new' })}>
          + Novo exemplar
        </button>
      </header>
      <nav>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-current={view.kind === 'tab' && tab === t ? 'page' : undefined}
            onClick={() => {
              setTab(t);
              setView({ kind: 'tab' });
            }}
          >
            {label(t)}
          </button>
        ))}
      </nav>
      <main>{body}</main>
    </div>
  );
}

export function App({ store }: { store: Store }) {
  const [initial, setInitial] = useState<Collection | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    store.loadOrSeed().then(setInitial, (err: Error) => setError(err.message));
  }, [store]);
  const save = useCallback((c: Collection) => void store.save(c), [store]);

  if (error) return <p role="alert">Erro ao carregar: {error}</p>;
  if (!initial) return <p>Carregando…</p>;
  return (
    <CollectionProvider initial={initial} onChange={save}>
      <Shell />
    </CollectionProvider>
  );
}
