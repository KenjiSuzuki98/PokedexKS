import { generateSlots } from './slots';
import { collection, species } from './test-helpers';

const ids = (c = collection()) => generateSlots(c).map((s) => s.id);

describe('generateSlots', () => {
  it('gera vagas com Nº Pokédex de 4 dígitos + código', () => {
    const all = ids();
    expect(all).toEqual(
      expect.arrayContaining([
        '0025EV', '0025BR', '0025NB', '0025RN', '0025SB', '0025PU', '0025TN', '0025SO',
        '0025ST', '0025FN', '0025MD', '0025XXL', '0025XXS', '0025MA', '0025FE',
        '0172EV', '0026EV',
      ]),
    );
  });

  it('todo ID cabe em 12 caracteres e é único', () => {
    const all = ids();
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id.length).toBeLessThanOrEqual(12);
  });

  it('formas de potencial só existem se a espécie pode tê-las', () => {
    const c = collection({
      species: [species({ id: 'venusaur', name: 'Venusaur', dex: 3, mega: true, gigamax: true })],
    });
    const all = ids(c);
    expect(all).toContain('0003MG');
    expect(all).toContain('0003GX');
    expect(all).not.toContain('0003DX');
    expect(ids()).not.toContain('0025MG');
  });

  it('sem brilhante na espécie, não há vaga brilhante', () => {
    const c = collection({ species: [species({ id: 'x', name: 'X', dex: 999 })] });
    expect(ids(c)).not.toContain('0999BR');
    expect(ids(c)).toContain('0999NB');
  });

  it('espécie sem gênero ou de um sexo só não tem vagas de sexo', () => {
    const c = collection({
      species: [
        species({ id: 'magnemite', name: 'Magnemite', dex: 81, gender: 'sem' }),
        species({ id: 'chansey', name: 'Chansey', dex: 113, gender: 'femea' }),
      ],
    });
    const all = ids(c);
    for (const id of ['0081MA', '0081FE', '0113MA', '0113FE']) expect(all).not.toContain(id);
  });

  it('cada traje é uma vaga, com versão brilhante quando existe', () => {
    const c = collection({
      species: [
        species({
          id: 'pikachu', name: 'Pikachu', dex: 25, shiny: true,
          costumes: [
            { id: 'festa', code: 'FEST', name: 'Festa', shiny: true },
            { id: 'bone', code: 'BONE', name: 'Boné', shiny: false },
          ],
        }),
      ],
    });
    const all = ids(c);
    expect(all).toEqual(expect.arrayContaining(['0025TFEST', '0025BTFEST', '0025TBONE']));
    expect(all).not.toContain('0025BTBONE');
  });

  it('forma regional entra no prefixo', () => {
    const c = collection({ species: [species({ id: 'raichu-alola', name: 'Raichu de Alola', dex: 26, form: 'A' })] });
    expect(ids(c)).toContain('0026AEV');
  });

  it('fundos registrados viram vagas para as espécies que podem tê-los', () => {
    const c = collection({
      backgrounds: [
        { id: 'b1', code: 'L1', name: 'Paris', type: 'localidade', species: ['pikachu'] },
        { id: 'b2', code: 'S1', name: 'GO Fest', type: 'especial', species: 'todas' },
      ],
    });
    const all = ids(c);
    expect(all).toContain('0025FL1');
    expect(all).not.toContain('0026FL1');
    expect(all).toContain('0026FS1');
  });

  it('categorias novas criadas pelo usuário viram vagas', () => {
    const c = collection({
      customCategories: [
        { id: 'chapeu', name: 'Chapéu', species: ['pikachu'], values: [{ id: 'sim', code: 'CH', name: 'Com chapéu' }] },
      ],
    });
    expect(ids(c)).toContain('0025CH');
  });
});
