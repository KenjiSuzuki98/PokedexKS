import { computeCollection } from './assign';
import { activateEvent, addCostume, addEvent, registerBackground } from './events';
import {
  acknowledgeOpenedSlots,
  addExemplar,
  addSpecies,
  confirmRename,
  editSpecies,
  mergeSpeciesTable,
  exemplarWarnings,
  removeExemplar,
  replaceExemplar,
  updateExemplar,
} from './ops';
import { collection, ex, iv, species } from './test-helpers';

describe('exemplares', () => {
  it('cadastrar, editar e remover recalculam as vagas', () => {
    const a = ex({ speciesId: 'raichu', iv: iv(80) });
    const b = ex({ speciesId: 'raichu', iv: iv(70) });
    let c = addExemplar(addExemplar(collection(), a), b);
    expect(computeCollection(c).occupancy['0026EV']).toBe(a.id);

    c = updateExemplar(c, b.id, { iv: iv(99), shiny: true });
    expect(computeCollection(c).occupancy['0026EV']).toBe(b.id);
    expect(c.exemplars.find((e) => e.id === b.id)!.shiny).toBe(true);

    c = removeExemplar(c, b.id);
    expect(computeCollection(c).occupancy['0026EV']).toBe(a.id);
  });

  it('substituir o exemplar inteiro permite limpar campos e mantém a posição', () => {
    const a = ex({ speciesId: 'raichu', notes: 'x', costumeId: null });
    const b = ex({ speciesId: 'raichu' });
    const c = replaceExemplar(addExemplar(addExemplar(collection(), a), b), { ...a, notes: undefined, cp: 10 } as never);
    expect(c.exemplars.map((e) => e.id)).toEqual([a.id, b.id]);
    expect(c.exemplars[0]).toEqual({ ...a, notes: undefined, cp: 10 });
    expect(() => replaceExemplar(c, ex({ speciesId: 'raichu' }))).toThrow();
    expect(() => replaceExemplar(c, { ...a, speciesId: 'nada' })).toThrow();
  });

  it('recusa id repetido, espécie desconhecida e exemplar inexistente', () => {
    const a = ex({ speciesId: 'raichu' });
    const c = addExemplar(collection(), a);
    expect(() => addExemplar(c, a)).toThrow();
    expect(() => addExemplar(c, ex({ speciesId: 'nada' }))).toThrow();
    expect(() => updateExemplar(c, 'nada', {})).toThrow();
    expect(() => removeExemplar(c, 'nada')).toThrow();
  });

  it('confirmar renomeação tira o exemplar das pendências', () => {
    const a = ex({ speciesId: 'raichu', iv: iv(80) });
    let c = addExemplar(collection(), a);
    expect(computeCollection(c).renamePending).toHaveLength(1);
    c = confirmRename(c, a.id, '0026EV');
    expect(computeCollection(c).renamePending).toEqual([]);
  });

  it('avisa sobre dados inconsistentes', () => {
    const c = collection({
      species: [...collection().species, species({ id: 'magnemite', name: 'Magnemite', dex: 81, gender: 'sem' })],
    });
    expect(exemplarWarnings(c, ex({ speciesId: 'raichu', lucky: true, origin: 'capturado' }))).toEqual([
      expect.stringMatching(/sortudo/i),
    ]);
    expect(exemplarWarnings(c, ex({ speciesId: 'magnemite', sex: 'macho' }))).toEqual([expect.stringMatching(/sexo/i)]);
    expect(exemplarWarnings(c, ex({ speciesId: 'raichu', sex: null }))).toEqual([expect.stringMatching(/sexo/i)]);
    expect(exemplarWarnings(c, ex({ speciesId: 'raichu', costumeId: 'xx' }))).toEqual([expect.stringMatching(/traje/i)]);
    expect(exemplarWarnings(c, ex({ speciesId: 'raichu', backgroundId: 'xx' }))).toEqual([expect.stringMatching(/fundo/i)]);
    expect(exemplarWarnings(c, ex({ speciesId: 'raichu' }))).toEqual([]);
  });
});

describe('tabela de espécies', () => {
  it('marcar Mega cria a vaga e ela fica como nova vaga aberta', () => {
    const c = editSpecies(collection(), 'raichu', { mega: true });
    expect(computeCollection(c).slots.map((s) => s.id)).toContain('0026MG');
    expect(c.openedSlots).toEqual(['0026MG']);
    expect(acknowledgeOpenedSlots(c).openedSlots).toEqual([]);
  });

  it('não deixa mudar Nº, forma ou id (isso mudaria IDs de vaga)', () => {
    expect(() => editSpecies(collection(), 'raichu', { dex: 27 })).toThrow();
    expect(() => editSpecies(collection(), 'raichu', { form: 'A' })).toThrow();
    expect(() => editSpecies(collection(), 'raichu', { id: 'x' } as never)).toThrow();
  });

  it('adicionar espécie abre as vagas dela e valida a tabela', () => {
    const c = addSpecies(collection(), species({ id: 'raichu-alola', name: 'Raichu de Alola', dex: 26, form: 'A', evolvesFrom: 'pikachu' }));
    expect(c.openedSlots).toContain('0026AEV');
    expect(() => addSpecies(c, species({ id: 'r2', name: 'R2', dex: 26 }))).toThrow(/0026EV/);
  });

  it('traje, fundo e evento também registram vagas abertas', () => {
    let c = addCostume(collection(), 'pikachu', { name: 'Festa', shiny: false });
    expect(c.openedSlots).toEqual(['0025TFEST']);
    c = registerBackground(c, { name: 'Paris', type: 'localidade', speciesId: 'pikachu' }).collection;
    expect(c.openedSlots).toEqual(['0025TFEST', '0025FL1']);
    c = addEvent(c, { id: 'e', name: 'E', start: '2026-01-01', end: '2026-01-02', description: '', active: false, brings: { forms: [{ speciesId: 'raichu', form: 'gigamax' }] } });
    c = activateEvent(c, 'e').collection;
    expect(c.openedSlots).toContain('0026GX');
  });
});

describe('mergeSpeciesTable', () => {
  const incoming = () => [
    species({ id: 'pichu', name: 'Pichu', dex: 172, shiny: true, base: { atk: 77, def: 53, sta: 85 } }),
    species({
      id: 'pikachu', name: 'Pikachu', dex: 25, evolvesFrom: 'pichu', shiny: true, gigamax: true,
      base: { atk: 112, def: 96, sta: 111 }, costumes: [{ id: 'pikachu-festa', code: 'FEST', name: 'Festa', shiny: true }],
    }),
    species({ id: 'raichu', name: 'Raichu', dex: 26, evolvesFrom: 'pikachu', shiny: true, base: { atk: 193, def: 151, sta: 155 } }),
    species({ id: 'raichu-alola', name: 'Raichu de Alola', dex: 26, form: 'A', evolvesFrom: 'pikachu' }),
  ];

  it('acrescenta espécies, fantasias e marcações sem mudar IDs de vaga existentes', () => {
    const before = collection({ exemplars: [ex({ speciesId: 'raichu', iv: iv(90) })] });
    const after = mergeSpeciesTable(before, incoming());
    const ids = (c: typeof before) => computeCollection(c).slots.map((s) => s.id);
    expect(ids(after)).toEqual(expect.arrayContaining(ids(before)));
    expect(ids(after)).toEqual(expect.arrayContaining(['0026AEV', '0025GX', '0025TFEST', '0025BTFEST']));
    expect(after.exemplars).toEqual(before.exemplars);
  });

  it('atualiza atributos base, mas nunca desliga marcações nem remove fantasias', () => {
    const mine = collection({
      species: collection().species.map((s) =>
        s.id === 'raichu' ? { ...s, mega: true, base: { atk: 1, def: 1, sta: 1 }, costumes: [{ id: 'minha', code: 'MINH', name: 'Minha', shiny: false }] } : s,
      ),
    });
    const raichu = mergeSpeciesTable(mine, incoming()).species.find((s) => s.id === 'raichu')!;
    expect(raichu.mega).toBe(true);
    expect(raichu.base).toEqual({ atk: 193, def: 151, sta: 155 });
    expect(raichu.costumes.map((t) => t.id)).toEqual(['minha']);
  });

  it('reconhece a espécie pelo Nº e forma quando o id é diferente', () => {
    const c = mergeSpeciesTable(collection(), [species({ id: 'outro-id', name: 'Pikachu', dex: 25, gigamax: true })]);
    expect(c.species.filter((s) => s.dex === 25)).toHaveLength(1);
    expect(c.species.find((s) => s.id === 'pikachu')!.gigamax).toBe(true);
  });

  it('fantasia nova com código já usado na espécie ganha outro código', () => {
    const mine = collection({
      species: collection().species.map((s) =>
        s.id === 'pikachu' ? { ...s, costumes: [{ id: 'minha', code: 'FEST', name: 'Festão', shiny: false }] } : s,
      ),
    });
    const pika = mergeSpeciesTable(mine, incoming()).species.find((s) => s.id === 'pikachu')!;
    expect(pika.costumes.map((t) => t.code)).toEqual(['FEST', 'FES2']);
  });
});
