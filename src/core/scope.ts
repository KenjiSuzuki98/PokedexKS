import type { CollectionResult } from './assign';
import { chainRoot, depth, speciesMap } from './chain';
import type { Collection, Slot } from './types';

export type Scope =
  | { kind: 'all' }
  | { kind: 'chain'; rootId: string }
  | { kind: 'species'; speciesId: string }
  | { kind: 'category'; category: string };

export interface SlotRow {
  slot: Slot;
  occupantId: string | null;
  /** Ocupada por uma reserva aguardando evolução. */
  reserved: boolean;
}

/** Vagas de um card da Coleção, na ordem da Pokédex e da evolução. */
export function slotsInScope(c: Collection, r: CollectionResult, scope: Scope): SlotRow[] {
  const byId = speciesMap(c);
  const order = new Map(
    [...c.species]
      .sort((a, b) => {
        const ra = chainRoot(a, byId);
        const rb = chainRoot(b, byId);
        return ra.dex - rb.dex || ra.id.localeCompare(rb.id) || depth(a, byId) - depth(b, byId) || a.dex - b.dex;
      })
      .map((s, i) => [s.id, i]),
  );
  const inScope = (slot: Slot) => {
    switch (scope.kind) {
      case 'all': return true;
      case 'species': return slot.speciesId === scope.speciesId;
      case 'category': return slot.category === scope.category;
      case 'chain': {
        const sp = byId.get(slot.speciesId);
        return !!sp && chainRoot(sp, byId).id === scope.rootId;
      }
    }
  };
  return r.slots
    .map((slot, i) => ({ slot, i }))
    .filter(({ slot }) => inScope(slot))
    .sort((a, b) => (order.get(a.slot.speciesId) ?? 0) - (order.get(b.slot.speciesId) ?? 0) || a.i - b.i)
    .map(({ slot }) => {
      const occupantId = r.occupancy[slot.id] ?? null;
      return { slot, occupantId, reserved: !!occupantId && !!r.exemplars[occupantId]?.reservedFor };
    });
}
