import { generateSlots } from './slots';
import type { Collection, Species } from './types';

export type SpeciesMap = Map<string, Species>;

export const speciesMap = (c: Collection): SpeciesMap => new Map(c.species.map((s) => [s.id, s]));

/** Quantas pré-evoluções a espécie tem (Pichu 0, Pikachu 1, Raichu 2). */
export function depth(sp: Species, byId: SpeciesMap): number {
  let d = 0;
  let cur = sp.evolvesFrom ? byId.get(sp.evolvesFrom) : undefined;
  while (cur && d <= byId.size) {
    d += 1;
    cur = cur.evolvesFrom ? byId.get(cur.evolvesFrom) : undefined;
  }
  return d;
}

/** Espécie base da cadeia. */
export function chainRoot(sp: Species, byId: SpeciesMap): Species {
  let cur = sp;
  for (let i = 0; cur.evolvesFrom && byId.has(cur.evolvesFrom) && i <= byId.size; i++) cur = byId.get(cur.evolvesFrom)!;
  return cur;
}

/** Problemas na tabela de espécies (lista vazia = tabela válida). */
export function validateSpeciesTable(c: Collection): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const s of c.species) {
    if (seen.has(s.id)) errors.push(`Id de espécie repetido: ${s.id}`);
    seen.add(s.id);
  }
  const byId = speciesMap(c);
  for (const s of c.species) {
    if (s.evolvesFrom && !byId.has(s.evolvesFrom)) errors.push(`${s.id}: pré-evolução inexistente "${s.evolvesFrom}"`);
    const visited = new Set([s.id]);
    for (let cur = s.evolvesFrom ? byId.get(s.evolvesFrom) : undefined; cur; cur = cur.evolvesFrom ? byId.get(cur.evolvesFrom) : undefined) {
      if (visited.has(cur.id)) {
        errors.push(`${s.id}: ciclo na cadeia de evolução`);
        break;
      }
      visited.add(cur.id);
    }
  }
  const slotIds = new Set<string>();
  for (const slot of generateSlots(c)) {
    if (slotIds.has(slot.id)) errors.push(`ID de vaga repetido: ${slot.id}`);
    slotIds.add(slot.id);
  }
  return [...new Set(errors)];
}
