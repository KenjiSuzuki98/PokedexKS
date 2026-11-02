import type { CollectionResult } from './assign';
import { chainRoot, speciesMap } from './chain';
import type { Collection, GameEvent, Slot } from './types';

export interface Progress {
  /** Vagas ocupadas por exemplares que já estão na fase da vaga. */
  filled: number;
  /** Vagas ocupadas por reservas aguardando evolução. */
  reserved: number;
  total: number;
  /** filled / total, de 0 a 100. */
  percent: number;
}

export interface ProgressReport {
  overall: Progress;
  bySpecies: Record<string, Progress>;
  /** Chave: id da espécie base da cadeia. */
  byChain: Record<string, Progress>;
  byCategory: Record<string, Progress>;
}

const empty = (): Progress => ({ filled: 0, reserved: 0, total: 0, percent: 0 });

function tally(p: Progress, kind: 'filled' | 'reserved' | null): void {
  p.total += 1;
  if (kind) p[kind] += 1;
  p.percent = p.total ? (p.filled / p.total) * 100 : 0;
}

function slotKind(r: CollectionResult, slot: Slot): 'filled' | 'reserved' | null {
  const occupant = r.occupancy[slot.id];
  if (!occupant) return null;
  return r.exemplars[occupant]?.reservedFor ? 'reserved' : 'filled';
}

export function computeProgress(c: Collection, r: CollectionResult): ProgressReport {
  const byId = speciesMap(c);
  const report: ProgressReport = { overall: empty(), bySpecies: {}, byChain: {}, byCategory: {} };
  for (const slot of r.slots) {
    const kind = slotKind(r, slot);
    const sp = byId.get(slot.speciesId)!;
    const root = chainRoot(sp, byId).id;
    tally(report.overall, kind);
    tally((report.bySpecies[slot.speciesId] ??= empty()), kind);
    tally((report.byChain[root] ??= empty()), kind);
    tally((report.byCategory[slot.category] ??= empty()), kind);
  }
  return report;
}

export interface TimelineEntry {
  event: GameEvent;
  slots: Slot[];
  opened: number;
  /** Vagas do evento ocupadas (inclui reservas). */
  filled: number;
  missing: number;
}

/** Eventos por data de início, com as vagas que abriram. Filtro opcional por período (AAAA-MM-DD). */
export function timeline(c: Collection, r: CollectionResult, period: { from?: string; to?: string } = {}): TimelineEntry[] {
  return [...c.events]
    .filter((ev) => (!period.from || ev.end >= period.from) && (!period.to || ev.start <= period.to))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
    .map((event) => {
      const slots = r.slots.filter((s) => s.since?.eventId === event.id);
      const filled = slots.filter((s) => r.occupancy[s.id]).length;
      return { event, slots, opened: slots.length, filled, missing: slots.length - filled };
    });
}
