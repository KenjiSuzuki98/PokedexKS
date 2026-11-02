import { validateSpeciesTable } from './chain';
import { collection, pichuLine, species } from './test-helpers';
import seed from '../data/species.json';
import type { Species } from './types';

describe('validateSpeciesTable', () => {
  it('a tabela inicial é válida e tem cadeias com e sem gênero', () => {
    const table = seed as Species[];
    expect(validateSpeciesTable(collection({ species: table }))).toEqual([]);
    expect(table.find((s) => s.id === 'raichu')?.evolvesFrom).toBe('pikachu');
    expect(table.some((s) => s.gender === 'sem')).toBe(true);
    expect(table.some((s) => s.gender === 'femea')).toBe(true);
  });

  it('aponta id repetido, pré-evolução inexistente e ciclo', () => {
    const errs = validateSpeciesTable(
      collection({
        species: [
          ...pichuLine,
          species({ id: 'pikachu', name: 'Outro', dex: 999 }),
          species({ id: 'x', name: 'X', dex: 900, evolvesFrom: 'nada' }),
          species({ id: 'a', name: 'A', dex: 901, evolvesFrom: 'b' }),
          species({ id: 'b', name: 'B', dex: 902, evolvesFrom: 'a' }),
        ],
      }),
    );
    expect(errs.join('\n')).toMatch(/repetido.*pikachu/);
    expect(errs.join('\n')).toMatch(/nada/);
    expect(errs.join('\n')).toMatch(/ciclo/);
  });

  it('aponta IDs de vaga repetidos (mesmo Nº e forma)', () => {
    const errs = validateSpeciesTable(collection({ species: [...pichuLine, species({ id: 'pika2', name: 'P2', dex: 25 })] }));
    expect(errs.join('\n')).toMatch(/0025EV/);
  });
});
