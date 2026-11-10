import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { makePokemonSearch, normalizeText, sortSpecies, type SpeciesOrder } from '../core/search';
import { slotPrefix } from '../core/slots';
import type { Collection, Species } from '../core/types';
import { useCollection } from './context';

/** O texto digitado aponta para uma espécie só? (nome exato, Nº ou código de renomear) */
function resolveExact(c: Collection, text: string, matches: Species[]): Species | undefined {
  const t = normalizeText(text);
  if (!t) return undefined;
  const digits = t.replace(/^#/, '');
  if (/^\d{1,4}$/.test(digits)) {
    const same = c.species.filter((s) => s.dex === Number(digits));
    return same.find((s) => !s.form) ?? same[0];
  }
  const byName = c.species.find((s) => normalizeText(s.name) === t);
  if (byName) return byName;
  if (/^\d{4}[a-z0-9]+$/.test(t) && matches.length === 1) return matches[0];
  return undefined;
}

/**
 * Campo de escolha de Pokémon: digita nome, Nº Pokédex ou código de renomear, ou rola a lista.
 * A lista pode ser ordenada por Nº ou por nome.
 */
export function SpeciesPicker(props: {
  label: string;
  value: string;
  onChange: (speciesId: string) => void;
  /** Lista de onde escolher (padrão: todas as espécies). */
  options?: Species[];
  placeholder?: string;
}) {
  const { collection: c, result: r } = useCollection();
  const listId = useId();
  const nameOf = (id: string) => c.species.find((s) => s.id === id)?.name ?? '';
  const [text, setText] = useState(() => nameOf(props.value));
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<SpeciesOrder>('dex');
  const [active, setActive] = useState(-1);

  // Escolha vinda de fora (ex.: abrir para editar): mostra o nome dela.
  useEffect(() => {
    const hit = resolveExact(c, text, []);
    const current = hit && (props.options ?? c.species).includes(hit) ? hit.id : undefined;
    if (props.value && props.value !== current) setText(nameOf(props.value));
    // Limpou de fora (o texto ainda apontava para uma espécie): limpa o campo também.
    if (!props.value && current) setText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  const search = useMemo(() => makePokemonSearch(c, r.slots), [c, r.slots]);
  const all = props.options ?? c.species;
  const sorted = useMemo(() => sortSpecies(all, order), [all, order]);
  const matches = useMemo(() => sorted.filter((s) => search.species(s, text)), [sorted, search, text]);

  function choose(sp: Species | undefined, shownText?: string) {
    setText(shownText ?? sp?.name ?? '');
    props.onChange(sp?.id ?? '');
  }

  function type(value: string) {
    setText(value);
    setOpen(true);
    setActive(-1);
    const filtered = sorted.filter((s) => search.species(s, value));
    const exact = resolveExact(c, value, filtered);
    props.onChange(exact && all.includes(exact) ? exact.id : '');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && active >= 0 && matches[active]) {
      e.preventDefault();
      choose(matches[active]);
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="picker">
      <input
        role="combobox"
        aria-label={props.label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={text}
        placeholder={props.placeholder ?? 'nome, Nº ou código'}
        onChange={(e) => type(e.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKey}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      />
      {open && (
        <div className="picker-pop" tabIndex={-1}>
          <div className="picker-order" role="group" aria-label="Ordem da lista">
            <button type="button" aria-label="Ordenar por Nº" aria-pressed={order === 'dex'} onClick={() => setOrder('dex')}>Nº</button>
            <button type="button" aria-label="Ordenar por nome" aria-pressed={order === 'nome'} onClick={() => setOrder('nome')}>A–Z</button>
            <button type="button" aria-label="Fechar lista" onClick={() => setOpen(false)}>✕</button>
          </div>
          <ul role="listbox" id={listId} aria-label={`Opções de ${props.label}`}>
            {matches.length === 0 && <li className="muted">Nenhum Pokémon encontrado</li>}
            {matches.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === active || s.id === props.value}
                className={i === active ? 'active' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  choose(s);
                  setOpen(false);
                }}
              >
                <code>{slotPrefix(s)}</code> {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
