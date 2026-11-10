import { ivScore, type CollectionResult } from './assign';
import { chainRoot, depth, speciesMap } from './chain';
import { makePokemonSearch } from './search';
import type { Collection, Exemplar } from './types';

export type AttrKey =
  | 'evolucao' | 'cadeia' | 'especie' | 'dex' | 'iv' | 'cp' | 'data' | 'status' | 'origem'
  | 'sexo' | 'tamanho' | 'brilhante' | 'sortudo' | 'rocket' | 'traje' | 'fundo' | 'evento' | 'codigo';

export interface SortCriterion {
  key: AttrKey;
  dir: 'asc' | 'desc';
}

export type Filter =
  | { key: AttrKey; value: string | number | boolean }
  | { key: AttrKey; min?: number; max?: number };

type Value = string | number | boolean | (string | number)[];

const STATUS_ORDER = { manter: 0, trocar: 1, descartar: 2 };

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Valor de um atributo do exemplar, usado tanto para ordenar quanto para filtrar. */
function makeGetter(c: Collection, r: CollectionResult) {
  const byId = speciesMap(c);
  return (e: Exemplar, key: AttrKey): Value => {
    const sp = byId.get(e.speciesId);
    switch (key) {
      case 'evolucao': {
        if (!sp) return [Infinity];
        const root = chainRoot(sp, byId);
        return [root.dex, root.id, depth(sp, byId), sp.dex, sp.form ?? ''];
      }
      case 'cadeia': return sp ? chainRoot(sp, byId).id : '';
      case 'especie': return e.speciesId;
      case 'dex': return sp?.dex ?? Infinity;
      case 'iv': return ivScore(e);
      case 'cp': return e.cp ?? -1;
      case 'data': return e.date;
      case 'status': return r.exemplars[e.id]?.status ?? '';
      case 'origem': return e.origin;
      case 'sexo': return e.sex ?? '';
      case 'tamanho': return e.size;
      case 'brilhante': return e.shiny;
      case 'sortudo': return e.lucky;
      case 'rocket': return e.rocket;
      case 'traje': return e.costumeId ?? '';
      case 'fundo': return e.backgroundId ?? '';
      case 'evento': return e.eventId ?? '';
      case 'codigo': return r.exemplars[e.id]?.nickname ?? '';
    }
  };
}

function sortable(key: AttrKey, v: Value): Value {
  if (key === 'status' && typeof v === 'string') return STATUS_ORDER[v as keyof typeof STATUS_ORDER] ?? 9;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

function compare(a: Value, b: Value): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = compare(a[i] ?? '', b[i] ?? '');
      if (d) return d;
    }
    return 0;
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/** Ordena por um ou mais critérios combinados (o primeiro manda, os seguintes desempatam). */
export function sortExemplars(c: Collection, r: CollectionResult, list: Exemplar[], criteria: SortCriterion[]): Exemplar[] {
  const get = makeGetter(c, r);
  return [...list].sort((a, b) => {
    for (const { key, dir } of criteria) {
      const d = compare(sortable(key, get(a, key)), sortable(key, get(b, key)));
      if (d) return dir === 'asc' ? d : -d;
    }
    return 0;
  });
}

export function filterExemplars(
  c: Collection,
  r: CollectionResult,
  list: Exemplar[],
  q: { filters?: Filter[]; text?: string },
): Exemplar[] {
  const get = makeGetter(c, r);
  const byId = speciesMap(c);
  const search = makePokemonSearch(c, r.slots);
  const text = q.text?.trim() ?? '';
  return list.filter((e) => {
    if (text) {
      const sp = byId.get(e.speciesId);
      const hit =
        (sp && search.species(sp, text)) ||
        search.code([r.exemplars[e.id]?.nickname, e.nickname], text) ||
        normalize(e.notes ?? '').includes(normalize(text));
      if (!hit) return false;
    }
    return (q.filters ?? []).every((f) => {
      const v = get(e, f.key);
      if ('value' in f) return v === f.value;
      const n = typeof v === 'number' ? v : NaN;
      return (f.min === undefined || n >= f.min) && (f.max === undefined || n <= f.max);
    });
  });
}
