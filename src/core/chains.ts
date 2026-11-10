import type { CollectionResult } from './assign';
import { chainRoot, depth, speciesMap } from './chain';
import type { Progress, ProgressReport } from './progress';
import { regionOf } from './region';
import { makePokemonSearch } from './search';
import type { Collection, Species } from './types';

export type ChainSortKey = 'dex' | 'nome' | 'progresso' | 'inclusao';
export type ChainFilter = 'todas' | 'iniciadas' | 'vazias' | 'completas' | 'incompletas' | 'com-reservas';

export interface ChainQuery {
  sort: { key: ChainSortKey; dir: 'asc' | 'desc' };
  filter: ChainFilter;
  region?: string;
  text?: string;
}

export interface ChainRow {
  rootId: string;
  root: Species;
  /** Fases da cadeia na ordem da evolução. */
  members: Species[];
  progress: Progress;
  /** Inclusão mais recente de um exemplar da cadeia ('' = nenhum). */
  lastAdded: string;
}

const FILTERS: Record<ChainFilter, (p: Progress) => boolean> = {
  todas: () => true,
  iniciadas: (p) => p.filled + p.reserved > 0,
  vazias: (p) => p.filled + p.reserved === 0,
  completas: (p) => p.total > 0 && p.filled === p.total,
  incompletas: (p) => p.filled < p.total,
  'com-reservas': (p) => p.reserved > 0,
};

/** Cadeias da Coleção com ordenação e filtros. */
export function listChains(c: Collection, r: CollectionResult, report: ProgressReport, q: ChainQuery): ChainRow[] {
  const byId = speciesMap(c);
  const groups = new Map<string, Species[]>();
  for (const sp of c.species) {
    const root = chainRoot(sp, byId).id;
    const list = groups.get(root);
    if (list) list.push(sp);
    else groups.set(root, [sp]);
  }
  const lastAdded = new Map<string, string>();
  for (const e of c.exemplars) {
    const sp = byId.get(e.speciesId);
    if (!sp) continue;
    const root = chainRoot(sp, byId).id;
    const when = e.addedAt ?? e.date;
    if (when > (lastAdded.get(root) ?? '')) lastAdded.set(root, when);
  }

  const search = q.text?.trim() ? makePokemonSearch(c, r.slots) : null;
  const rows: ChainRow[] = [];
  for (const [rootId, members] of groups) {
    const root = byId.get(rootId)!;
    const progress = report.byChain[rootId] ?? { filled: 0, reserved: 0, total: 0, percent: 0 };
    if (!FILTERS[q.filter](progress)) continue;
    if (q.region && regionOf(root.dex) !== q.region) continue;
    if (search && !members.some((s) => search.species(s, q.text!))) continue;
    members.sort((a, b) => depth(a, byId) - depth(b, byId) || a.dex - b.dex);
    rows.push({ rootId, root, members, progress, lastAdded: lastAdded.get(rootId) ?? '' });
  }

  const sign = q.sort.dir === 'asc' ? 1 : -1;
  const byDex = (a: ChainRow, b: ChainRow) => a.root.dex - b.root.dex || a.rootId.localeCompare(b.rootId);
  return rows.sort((a, b) => {
    switch (q.sort.key) {
      case 'dex':
        return sign * byDex(a, b);
      case 'nome':
        return sign * a.root.name.localeCompare(b.root.name, 'pt-BR') || byDex(a, b);
      case 'progresso':
        return sign * (a.progress.percent - b.progress.percent) || byDex(a, b);
      case 'inclusao':
        // Cadeias sem nenhum exemplar ficam sempre no fim.
        if (!a.lastAdded || !b.lastAdded) return (a.lastAdded ? -1 : 0) + (b.lastAdded ? 1 : 0) || byDex(a, b);
        return sign * a.lastAdded.localeCompare(b.lastAdded) || byDex(a, b);
    }
  });
}
