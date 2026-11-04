import { regionOf } from './region';

describe('regionOf', () => {
  it('região pelo Nº da Pokédex', () => {
    const cases: [number, string][] = [
      [1, 'Kanto'], [151, 'Kanto'], [152, 'Johto'], [251, 'Johto'], [252, 'Hoenn'], [386, 'Hoenn'],
      [387, 'Sinnoh'], [493, 'Sinnoh'], [494, 'Unova'], [649, 'Unova'], [650, 'Kalos'], [721, 'Kalos'],
      [722, 'Alola'], [809, 'Alola'], [810, 'Galar'], [898, 'Galar'], [899, 'Hisui'], [905, 'Hisui'],
      [906, 'Paldea'], [1025, 'Paldea'],
    ];
    for (const [dex, region] of cases) expect(regionOf(dex), String(dex)).toBe(region);
  });
  it('fora da faixa conhecida', () => {
    expect(regionOf(0)).toBe('—');
    expect(regionOf(1026)).toBe('—');
  });
});
