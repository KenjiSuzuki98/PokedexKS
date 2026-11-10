import { computeCollection } from './assign';
import {
  activateEvent, addCostume, addCustomCategory, addEvent, costumeEntries, deleteEvent, editCostume, makeCode,
  registerBackground, removeCostume, sameNameCostume, updateEvent,
} from './events';
import { generateSlots } from './slots';
import { collection, ex, iv } from './test-helpers';
import type { GameEvent } from './types';

const slotIds = (c: Parameters<typeof generateSlots>[0]) => generateSlots(c).map((s) => s.id);

describe('makeCode', () => {
  it('gera código curto, sem acento, em maiúsculas', () => {
    expect(makeCode('Chapéu de Festa', [])).toBe('CHAP');
  });
  it('dá nome a símbolos que não viram letras', () => {
    expect(makeCode('!', [])).toBe('EXCL');
    expect(makeCode('?', [])).toBe('INTE');
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

  it('traje chamado "N" não colide com a vaga TN (troca normal)', () => {
    const c = addCostume(collection(), 'pikachu', { name: 'N', shiny: false });
    const ids = slotIds(c);
    expect(new Set(ids).size).toBe(ids.length);
    expect(c.species.find((s) => s.id === 'pikachu')!.costumes[0]!.code).not.toBe('N');
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

describe('trajes sem duplicados', () => {
  it('traje com o mesmo nome (ignorando acento e maiúsculas) reaproveita o que já existe', () => {
    let c = addCostume(collection(), 'pikachu', { name: 'Boina Preta', shiny: false });
    c = addCostume(c, 'pikachu', { name: 'boina preta', shiny: false, costumeId: 'outro-id' });
    expect(c.species.find((s) => s.id === 'pikachu')!.costumes).toHaveLength(1);
  });

  it('sameNameCostume acha o traje de mesmo nome na espécie', () => {
    const c = addCostume(collection(), 'pikachu', { name: 'Boina', shiny: false });
    expect(sameNameCostume(c, 'pikachu', 'BOINA')?.id).toBe('boina');
    expect(sameNameCostume(c, 'raichu', 'Boina')).toBeUndefined();
  });

  it('costumeEntries com evoluções cria a mesma entrada (mesmo id) para toda a cadeia acima', () => {
    const list = costumeEntries(collection(), { speciesId: 'pikachu', name: 'Boina', shiny: true }, true);
    expect(list).toEqual([
      { speciesId: 'pikachu', name: 'Boina', shiny: true, costumeId: 'boina' },
      { speciesId: 'raichu', name: 'Boina', shiny: true, costumeId: 'boina' },
    ]);
  });
});

describe('editar e remover trajes', () => {
  const base = () => {
    let c = addCostume(collection(), 'pikachu', { name: 'Boina', shiny: false });
    return addCostume(c, 'raichu', { name: 'Boina', shiny: false });
  };

  it('renomear e marcar brilhante muda em todas as espécies sem mudar o ID das vagas existentes', () => {
    const before = base();
    const after = editCostume(before, 'boina', { name: 'Boina Preta Thunder', shiny: true });
    for (const id of ['pikachu', 'raichu']) {
      expect(after.species.find((s) => s.id === id)!.costumes[0]).toMatchObject({ id: 'boina', code: 'BOIN', name: 'Boina Preta Thunder', shiny: true });
    }
    expect(slotIds(after)).toEqual(expect.arrayContaining(slotIds(before)));
    expect(slotIds(after)).toContain('0025BTBOIN');
  });

  it('remover traje sem uso tira as vagas; em uso, recusa', () => {
    const c = base();
    const removed = removeCostume(c, 'boina', 'raichu');
    expect(removed.species.find((s) => s.id === 'raichu')!.costumes).toEqual([]);
    expect(removed.species.find((s) => s.id === 'pikachu')!.costumes).toHaveLength(1);
    const used = { ...c, exemplars: [ex({ speciesId: 'pikachu', costumeId: 'boina' })] };
    expect(() => removeCostume(used, 'boina', 'pikachu')).toThrow(/em uso/);
  });
});

describe('editar eventos', () => {
  const evento: GameEvent = {
    id: 'ev1', name: 'Pikachu Thunder', start: '2025-06-01', end: '2025-06-02', description: '', active: false,
    brings: { costumes: [{ speciesId: 'pikachu', name: 'Boina', shiny: false }, { speciesId: 'raichu', name: 'Boina', shiny: false }] },
  };
  const active = () => activateEvent(addEvent(collection(), evento), 'ev1').collection;

  it('ativar grava o id do traje no evento', () => {
    expect(active().events[0]!.brings.costumes!.map((t) => t.costumeId)).toEqual(['boina', 'boina']);
  });

  it('evento não ativado: editar só troca os dados, sem vagas', () => {
    const c0 = addEvent(collection(), evento);
    const c = updateEvent(c0, { ...evento, name: 'Outro nome' });
    expect(c.events[0]!.name).toBe('Outro nome');
    expect(slotIds(c)).toEqual(slotIds(c0));
  });

  it('evento ativo: renomear traje, mudar data, incluir e tirar itens refletem na tabela sem mudar IDs', () => {
    const c0 = active();
    const ev = c0.events[0]!;
    const next: GameEvent = {
      ...ev,
      start: '2025-06-05',
      brings: {
        costumes: [
          { ...ev.brings.costumes![0]!, name: 'Boina Preta', shiny: true },
          { speciesId: 'pichu', name: 'Boina Preta', shiny: false, costumeId: 'boina' },
        ],
        shinyDebuts: ['pichu'],
      },
    };
    const c = updateEvent(c0, next);
    const pika = c.species.find((s) => s.id === 'pikachu')!;
    expect(pika.costumes[0]).toMatchObject({ id: 'boina', code: 'BOIN', name: 'Boina Preta', shiny: true, since: { eventId: 'ev1', date: '2025-06-05' } });
    expect(c.species.find((s) => s.id === 'raichu')!.costumes).toEqual([]);
    expect(c.species.find((s) => s.id === 'pichu')!.costumes.map((t) => t.id)).toEqual(['boina']);
    expect(c.species.find((s) => s.id === 'pichu')!.shiny).toBe(true);
    expect(slotIds(c)).toContain('0025TBOIN');
    expect(c.events[0]!.start).toBe('2025-06-05');
  });

  it('não tira do evento um traje que algum exemplar usa', () => {
    const c0 = { ...active(), exemplars: [ex({ speciesId: 'raichu', costumeId: 'boina' })] };
    const ev = c0.events[0]!;
    expect(() => updateEvent(c0, { ...ev, brings: { costumes: [ev.brings.costumes![0]!] } })).toThrow(/em uso/);
  });

  it('excluir evento ativo desfaz o que ele trouxe e limpa o evento de origem dos exemplares', () => {
    const c0 = active();
    const withEx = { ...c0, exemplars: [ex({ speciesId: 'pikachu', eventId: 'ev1' })] };
    const c = deleteEvent(withEx, 'ev1');
    expect(c.events).toEqual([]);
    expect(c.species.every((s) => s.costumes.length === 0)).toBe(true);
    expect(c.exemplars[0]!.eventId).toBeUndefined();
  });

  it('excluir evento recusa se um traje dele está em uso', () => {
    const c0 = { ...active(), exemplars: [ex({ speciesId: 'pikachu', costumeId: 'boina' })] };
    expect(() => deleteEvent(c0, 'ev1')).toThrow(/em uso/);
  });
});
