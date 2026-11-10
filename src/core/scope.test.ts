import { computeCollection } from './assign';
import { slotsInScope } from './scope';
import { collection, ex, iv } from './test-helpers';

describe('slotsInScope (lista interna de cada card da Coleção)', () => {
  // O Pikachu XXL fica reservado para a vaga Raichu XXL; o Raichu de verdade fica com o resto.
  const pika = ex({ speciesId: 'pikachu', iv: iv(96), size: 'xxl' });
  const pika2 = ex({ speciesId: 'pikachu', iv: iv(90) });
  const raichu = ex({ speciesId: 'raichu', iv: iv(50), shiny: true });
  const c = collection({ exemplars: [pika, pika2, raichu] });
  const r = computeCollection(c);

  it('por espécie: cada vaga com quem ocupa, se é reserva ou se está livre', () => {
    const rows = slotsInScope(c, r, { kind: 'species', speciesId: 'raichu' });
    expect(rows.map((x) => x.slot.speciesId)).toEqual(Array(rows.length).fill('raichu'));
    expect(rows.find((x) => x.slot.id === '0026XXL')).toMatchObject({ occupantId: pika.id, reserved: true });
    expect(rows.find((x) => x.slot.id === '0026EV')).toMatchObject({ occupantId: raichu.id, reserved: false });
    expect(rows.find((x) => x.slot.id === '0026XXS')).toMatchObject({ occupantId: null, reserved: false });
  });

  it('por cadeia: vagas de todas as fases, na ordem da evolução', () => {
    const rows = slotsInScope(c, r, { kind: 'chain', rootId: 'pichu' });
    const order = [...new Set(rows.map((x) => x.slot.speciesId))];
    expect(order).toEqual(['pichu', 'pikachu', 'raichu']);
  });

  it('por categoria e geral', () => {
    const shiny = slotsInScope(c, r, { kind: 'category', category: 'raridade' });
    expect(shiny.map((x) => x.slot.id)).toEqual(['0172NB', '0172BR', '0025NB', '0025BR', '0026NB', '0026BR']);
    expect(slotsInScope(c, r, { kind: 'all' })).toHaveLength(r.slots.length);
  });
});
