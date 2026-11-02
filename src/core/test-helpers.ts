import type { Collection, Exemplar, Species } from './types';

export function species(over: Partial<Species> & Pick<Species, 'id' | 'name' | 'dex'>): Species {
  return {
    gender: 'ambos',
    shiny: false,
    mega: false,
    dynamax: false,
    gigamax: false,
    costumes: [],
    base: { atk: 100, def: 100, sta: 100 },
    ...over,
  };
}

export const pichuLine: Species[] = [
  species({ id: 'pichu', name: 'Pichu', dex: 172, shiny: true, base: { atk: 77, def: 53, sta: 85 } }),
  species({ id: 'pikachu', name: 'Pikachu', dex: 25, evolvesFrom: 'pichu', shiny: true, base: { atk: 112, def: 96, sta: 111 } }),
  species({ id: 'raichu', name: 'Raichu', dex: 26, evolvesFrom: 'pikachu', shiny: true, base: { atk: 193, def: 151, sta: 155 } }),
];

let seq = 0;
export function ex(over: Partial<Exemplar> & Pick<Exemplar, 'speciesId'>): Exemplar {
  seq += 1;
  return {
    id: `e${seq}`,
    origin: 'capturado',
    date: '2026-01-01',
    sex: 'macho',
    size: 'normal',
    shiny: false,
    lucky: false,
    rocket: 'normal',
    ...over,
  };
}

export function iv(percent: number) {
  return { percent };
}

export function collection(over: Partial<Collection> = {}): Collection {
  return { species: pichuLine, backgrounds: [], customCategories: [], events: [], exemplars: [], ...over };
}
