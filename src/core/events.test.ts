import { computeCollection } from './assign';
import { activateEvent, addCostume, addCustomCategory, addEvent, makeCode, registerBackground } from './events';
import { generateSlots } from './slots';
import { collection, ex, iv } from './test-helpers';
import type { GameEvent } from './types';

const slotIds = (c: Parameters<typeof generateSlots>[0]) => generateSlots(c).map((s) => s.id);

describe('makeCode', () => {
  it('gera código curto, sem acento, em maiúsculas', () => {
    expect(makeCode('Chapéu de Festa', [])).toBe('CHAP');
  });
  it('resolve colisão com sufixo numérico', () => {
    expect(makeCode('Chapéu', ['CHAP'])).toBe('CHA2');
    expect(makeCode('Chapéu', ['CHAP', 'CHA2'])).toBe('CHA3');
  });
});

describe('trajes', () => {
  it('adicionar traje cria vaga normal e brilhante sem mudar nenhum ID existente', () => {
    const before = collection();
    const after = addCostume(before, 'pikachu', { name: 'Festa', shiny: true });
    const b = slotIds(before);
    const a = slotIds(after);
    expect(a).toEqual(expect.arrayContaining(b));
    expect(a.filter((id) => !b.includes(id)).sort()).toEqual(['0025BTFEST', '0025TFEST']);
  });

  it('código do traje é gravado e não muda quando entra outro com nome parecido', () => {
    let c = addCostume(collection(), 'pikachu', { name: 'Festa', shiny: false });
    c = addCostume(c, 'pikachu', { name: 'Festival', shiny: false });
    const codes = c.species.find((s) => s.id === 'pikachu')!.costumes.map((t) => t.code);
    expect(codes).toEqual(['FEST', 'FES2']);
  });
});

describe('fundos', () => {
  it('fundo novo cadastrado na hora vira vaga e o exemplar a ocupa', () => {
    const { collection: c, background } = registerBackground(collection(), { name: 'Paris', type: 'localidade', speciesId: 'pikachu' });
    expect(background.code).toBe('L1');
    const e = ex({ speciesId: 'pikachu', iv: iv(40), backgroundId: background.id });
    const r = computeCollection({ ...c, exemplars: [e] });
    expect(r.slots.map((s) => s.id)).toContain('0025FL1');
  });

  it('o mesmo fundo em outra espécie reaproveita o fundo e o código', () => {
    let { collection: c } = registerBackground(collection(), { name: 'Paris', type: 'localidade', speciesId: 'pikachu' });
    const r2 = registerBackground(c, { name: 'paris', type: 'localidade', speciesId: 'raichu' });
    c = r2.collection;
    expect(c.backgrounds).toHaveLength(1);
    expect(slotIds(c)).toEqual(expect.arrayContaining(['0025FL1', '0026FL1']));
    const second = registerBackground(c, { name: 'Tóquio', type: 'localidade', speciesId: 'pikachu' });
    expect(second.background.code).toBe('L2');
  });
});

describe('categorias novas', () => {
  it('criar categoria gera vagas sem alterar as existentes', () => {
    const before = collection();
    const after = addCustomCategory(before, { name: 'Chapéu', species: ['pikachu'], values: [{ name: 'Com chapéu', code: 'CH' }] });
    expect(slotIds(after)).toEqual(expect.arrayContaining(slotIds(before)));
    expect(slotIds(after)).toContain('0025CH');
  });

  it('rejeita código que colide com uma vaga existente', () => {
    expect(() => addCustomCategory(collection(), { name: 'X', species: 'todas', values: [{ name: 'X', code: 'BR' }] })).toThrow();
  });
});

describe('eventos', () => {
  const evento: GameEvent = {
    id: 'halloween-2026',
    name: 'Halloween 2026',
    start: '2026-10-20',
    end: '2026-10-31',
    description: '',
    active: false,
    brings: {
      costumes: [{ speciesId: 'pikachu', name: 'Bruxa', shiny: true }],
      backgrounds: [{ name: 'Lua Cheia', type: 'especial', species: ['raichu'] }],
      shinyDebuts: [],
      forms: [{ speciesId: 'raichu', form: 'dynamax' }],
    },
  };

  it('evento futuro não gera vagas até ser ativado', () => {
    const before = collection();
    const c = addEvent(before, evento);
    expect(slotIds(c)).toEqual(slotIds(before));
  });

  it('ativar o evento cria as vagas, marca a origem e devolve as novas vagas abertas', () => {
    const c0 = addEvent(collection(), evento);
    const { collection: c, newSlots } = activateEvent(c0, 'halloween-2026');
    expect(newSlots.map((s) => s.id).sort()).toEqual(['0025BTBRUX', '0025TBRUX', '0026DX', '0026FS1']);
    expect(slotIds(c)).toEqual(expect.arrayContaining(slotIds(c0)));
    for (const s of newSlots) expect(s.since).toEqual({ eventId: 'halloween-2026', date: '2026-10-20' });
    expect(c.events[0]!.active).toBe(true);
  });

  it('ativar duas vezes não duplica nada', () => {
    const c0 = addEvent(collection(), evento);
    const once = activateEvent(c0, 'halloween-2026').collection;
    const twice = activateEvent(once, 'halloween-2026');
    expect(twice.newSlots).toEqual([]);
  });
});
