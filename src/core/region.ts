// Primeiro Nº de cada região (ordem crescente).
const REGIONS: [number, string][] = [
  [1, 'Kanto'], [152, 'Johto'], [252, 'Hoenn'], [387, 'Sinnoh'], [494, 'Unova'],
  [650, 'Kalos'], [722, 'Alola'], [810, 'Galar'], [899, 'Hisui'], [906, 'Paldea'],
];
const LAST_DEX = 1025;

/** Região de origem pelo Nº da Pokédex. */
export function regionOf(dex: number): string {
  if (dex < 1 || dex > LAST_DEX) return '—';
  let name = '—';
  for (const [first, region] of REGIONS) if (dex >= first) name = region;
  return name;
}
