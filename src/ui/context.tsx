import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { computeCollection, type CollectionResult } from '../core/assign';
import type { Collection } from '../core/types';

interface Ctx {
  collection: Collection;
  result: CollectionResult;
  /** Aplica uma mudança. Se a função lançar erro, nada muda e o erro sobe para quem chamou. */
  update: (fn: (c: Collection) => Collection) => void;
  /** Troca a coleção inteira (ex.: importar backup). */
  replace: (c: Collection) => void;
}

const CollectionContext = createContext<Ctx | null>(null);

export function CollectionProvider(props: { initial: Collection; onChange?: (c: Collection) => void; children: ReactNode }) {
  const [collection, setCollection] = useState(props.initial);
  const ref = useRef(collection);
  const onChange = props.onChange;
  const replace = useCallback(
    (next: Collection) => {
      ref.current = next;
      setCollection(next);
      onChange?.(next);
    },
    [onChange],
  );
  const update = useCallback((fn: (c: Collection) => Collection) => replace(fn(ref.current)), [replace]);
  const result = useMemo(() => computeCollection(collection), [collection]);
  const value = useMemo(() => ({ collection, result, update, replace }), [collection, result, update, replace]);
  return <CollectionContext.Provider value={value}>{props.children}</CollectionContext.Provider>;
}

export function useCollection(): Ctx {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection fora do CollectionProvider');
  return ctx;
}
