import { computeCollection } from './assign';
import { collection, ex, iv, species } from './test-helpers';
import type { Exemplar } from './types';

const run = (exemplars: Exemplar[], over = {}) => computeCollection(collection({ exemplars, ...over }));

describe('cascata Pichu / Pikachu / Raichu', () => {
  const p96 = ex({ speciesId: 'pikachu', iv: iv(96), date: '2026-01-01' });
  const p85 = ex({ speciesId: 'pikachu', iv: iv(85), date: '2026-02-01' });
  const p98 = ex({ speciesId: 'pikachu', iv: iv(98), date: '2026-03-01' });

  it('Pikachu 96% sozinho fica reservado para Raichu e a vaga Pikachu fica livre', () => {
    const r = run([p96]);
    expect(r.exemplars[p96.id]).toMatchObject({ status: 'manter', phaseId: 'raichu', reservedFor: 'raichu' });
    expect(r.occupancy['0026EV']).toBe(p96.id);
    expect(r.occupancy['0025EV']).toBeNull();
  });

  it('entra um 85%: ele ocupa a vaga Pikachu', () => {
    const r = run([p96, p85]);
    expect(r.occupancy['0026EV']).toBe(p96.id);
    expect(r.occupancy['0025EV']).toBe(p85.id);
    expect(r.exemplars[p85.id]).toMatchObject({ status: 'manter', phaseId: 'pikachu' });
    expect(r.exemplars[p85.id]!.reservedFor).toBeUndefined();
  });

  it('entra um 98%: vira reserva de Raichu, o 96% desce e o 85% perde a vaga', () => {
    const r = run([p96, p85, p98]);
    expect(r.occupancy['0026EV']).toBe(p98.id);
    expect(r.occupancy['0025EV']).toBe(p96.id);
    expect(r.exemplars[p85.id]).toMatchObject({ status: 'trocar', slots: [] });
  });

  it('o 85% recebido em troca vira descartar', () => {
    const p85t = { ...p85, origin: 'troca' as const };
    expect(run([p96, p85t, p98]).exemplars[p85t.id]!.status).toBe('descartar');
  });

  it('ao evoluir de fato, a reserva vira vaga preenchida sem mudar a vaga', () => {
    const r = run([{ ...p96, speciesId: 'raichu' }]);
    expect(r.occupancy['0026EV']).toBe(p96.id);
    expect(r.exemplars[p96.id]!.reservedFor).toBeUndefined();
  });

  it('um Raichu de verdade com IV menor perde a vaga Raichu para o Pikachu reservado', () => {
    const r90 = ex({ speciesId: 'raichu', iv: iv(90) });
    const r = run([p96, r90]);
    expect(r.occupancy['0026EV']).toBe(p96.id);
    expect(r.exemplars[r90.id]!.status).toBe('trocar');
  });

  it('um exemplar de atributo raro reservado não tira a vaga de evolução da fase de baixo', () => {
    const shiny = ex({ speciesId: 'pikachu', iv: iv(50), shiny: true });
    const r = run([p96, p85, shiny]);
    expect(r.occupancy['0026BR']).toBe(shiny.id);
    expect(r.exemplars[shiny.id]!.phaseId).toBe('raichu');
    expect(r.occupancy['0025EV']).toBe(p85.id);
  });
});

describe('cadeia ramificada (Eevee)', () => {
  const sp = [
    species({ id: 'eevee', name: 'Eevee', dex: 133 }),
    species({ id: 'vaporeon', name: 'Vaporeon', dex: 134, evolvesFrom: 'eevee' }),
    species({ id: 'jolteon', name: 'Jolteon', dex: 135, evolvesFrom: 'eevee' }),
  ];

  it('cada ramo é uma vaga própria: os Eevees de maior IV vão para os ramos, o resto fica Eevee', () => {
    const a = ex({ speciesId: 'eevee', iv: iv(98) });
    const b = ex({ speciesId: 'eevee', iv: iv(90) });
    const c = ex({ speciesId: 'eevee', iv: iv(80) });
    const r = computeCollection(collection({ species: sp, exemplars: [a, b, c] }));
    expect([r.exemplars[a.id]!.phaseId, r.exemplars[b.id]!.phaseId].sort()).toEqual(['jolteon', 'vaporeon']);
    expect(r.exemplars[c.id]!.phaseId).toBe('eevee');
  });

  it('a reserva prefere um ramo livre a tirar a vaga de uma evolução já feita', () => {
    const j = ex({ speciesId: 'jolteon', iv: iv(70) });
    const e = ex({ speciesId: 'eevee', iv: iv(99) });
    const r = computeCollection(collection({ species: sp, exemplars: [j, e] }));
    expect(r.occupancy['0135EV']).toBe(j.id);
    expect(r.occupancy['0134EV']).toBe(e.id);
    expect(r.exemplars[j.id]!.status).toBe('manter');
  });
});

describe('várias vagas e status', () => {
  it('um exemplar ocupa várias vagas ao mesmo tempo', () => {
    const e = ex({ speciesId: 'raichu', iv: iv(70), shiny: true, lucky: true, size: 'xxl', sex: 'femea', origin: 'troca' });
    const r = run([e]);
    expect(r.exemplars[e.id]!.slots).toEqual(
      expect.arrayContaining(['0026EV', '0026BR', '0026SO', '0026XXL', '0026FE', '0026RN', '0026ST', '0026FN']),
    );
    expect(r.exemplars[e.id]!.status).toBe('manter');
  });

  it('sortudo sem vaga é sempre descartar, mesmo marcado como capturado', () => {
    const best = ex({ speciesId: 'raichu', iv: iv(100), lucky: true, origin: 'troca', date: '2025-01-01' });
    const worse = ex({ speciesId: 'raichu', iv: iv(10), lucky: true, origin: 'capturado' });
    const r = run([best, worse]);
    expect(r.exemplars[worse.id]!.status).toBe('descartar');
  });

  it('empate de IV: fica o mais antigo', () => {
    const novo = ex({ speciesId: 'raichu', iv: iv(90), date: '2026-05-01' });
    const antigo = ex({ speciesId: 'raichu', iv: iv(90), date: '2025-05-01' });
    const r = run([novo, antigo]);
    expect(r.occupancy['0026EV']).toBe(antigo.id);
    expect(r.exemplars[novo.id]!.status).toBe('trocar');
  });

  it('IV com valores detalhados desempata melhor que a porcentagem arredondada', () => {
    const a = ex({ speciesId: 'raichu', iv: { atk: 15, def: 15, sta: 13, percent: 96 } });
    const b = ex({ speciesId: 'raichu', iv: { atk: 15, def: 14, sta: 14, percent: 96 }, date: '2025-01-01' });
    const c = ex({ speciesId: 'raichu', iv: { atk: 15, def: 15, sta: 14, percent: 98 }, date: '2027-01-01' });
    expect(run([a, b, c]).occupancy['0026EV']).toBe(c.id);
  });

  it('espécie sem gênero não exige sexo e o exemplar ainda ganha vagas', () => {
    const mag = species({ id: 'magnemite', name: 'Magnemite', dex: 81, gender: 'sem' });
    const e = ex({ speciesId: 'magnemite', iv: iv(50), sex: null });
    const r = computeCollection(collection({ species: [mag], exemplars: [e] }));
    expect(r.exemplars[e.id]!.status).toBe('manter');
    expect(r.slots.some((s) => s.category === 'sexo')).toBe(false);
  });

  it('exemplar com traje só sobe para a fase que tem o mesmo traje', () => {
    const sp = [
      species({ id: 'pikachu', name: 'Pikachu', dex: 25, costumes: [{ id: 'festa', code: 'FEST', name: 'Festa', shiny: false }] }),
      species({ id: 'raichu', name: 'Raichu', dex: 26, evolvesFrom: 'pikachu' }),
    ];
    const e = ex({ speciesId: 'pikachu', iv: iv(99), costumeId: 'festa' });
    const r = computeCollection(collection({ species: sp, exemplars: [e] }));
    expect(r.exemplars[e.id]!.phaseId).toBe('pikachu');
    expect(r.occupancy['0025TFEST']).toBe(e.id);
  });
});

describe('IDs e renomeação', () => {
  it('o ID da vaga é estável quando o exemplar que a ocupa muda', () => {
    const a = ex({ speciesId: 'raichu', iv: iv(80) });
    const b = ex({ speciesId: 'raichu', iv: iv(95) });
    const r1 = run([a]);
    const r2 = run([a, b]);
    expect(r1.slots.map((s) => s.id)).toEqual(r2.slots.map((s) => s.id));
    expect(r1.occupancy['0026EV']).toBe(a.id);
    expect(r2.occupancy['0026EV']).toBe(b.id);
  });

  it('apelido sugerido é a vaga mais específica do exemplar', () => {
    const e = ex({ speciesId: 'raichu', iv: iv(70), shiny: true, size: 'xxl' });
    expect(run([e]).exemplars[e.id]!.nickname).toBe('0026BR');
    const plain = ex({ speciesId: 'raichu', iv: iv(70) });
    expect(run([plain]).exemplars[plain.id]!.nickname).toBe('0026EV');
  });

  it('trocar/descartar não recebem apelido', () => {
    const a = ex({ speciesId: 'raichu', iv: iv(80) });
    const b = ex({ speciesId: 'raichu', iv: iv(10) });
    expect(run([a, b]).exemplars[b.id]!.nickname).toBeNull();
  });

  it('editar um exemplar recalcula vagas e gera pendências de renomeação', () => {
    const a = ex({ speciesId: 'pikachu', iv: iv(90), nickname: '0026EV' });
    const b = ex({ speciesId: 'pikachu', iv: iv(80), nickname: '0025EV' });
    expect(run([a, b]).renamePending).toEqual([]);

    // corrijo o IV de b para 99: ele sobe para Raichu e a passa para Pikachu
    const r = run([a, { ...b, iv: iv(99) }]);
    expect(r.occupancy['0026EV']).toBe(b.id);
    expect(r.renamePending.map((p) => [p.exemplarId, p.from, p.to])).toEqual([
      [a.id, '0026EV', '0025EV'],
      [b.id, '0025EV', '0026EV'],
    ]);
  });

  it('exemplar que perdeu a vaga e ainda tem apelido de vaga entra nas pendências', () => {
    const a = ex({ speciesId: 'raichu', iv: iv(80), nickname: '0026EV' });
    const b = ex({ speciesId: 'raichu', iv: iv(95) });
    const pend = run([a, b]).renamePending;
    expect(pend).toContainEqual({ exemplarId: a.id, from: '0026EV', to: null });
    expect(pend).toContainEqual({ exemplarId: b.id, from: null, to: '0026EV' });
  });
});

describe('desempenho', () => {
  it('tabela grande (~1.300 espécies) com centenas de exemplares calcula rápido', () => {
    const big = Array.from({ length: 1300 }, (_, i) => species({ id: `s${i}`, name: `S${i}`, dex: i + 1 }));
    const exemplars = Array.from({ length: 400 }, (_, i) => ex({ speciesId: `s${i * 3}`, iv: iv(i % 100) }));
    const t0 = performance.now();
    const r = computeCollection(collection({ species: big, exemplars }));
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(Object.values(r.exemplars).every((e) => e.status === 'manter')).toBe(true);
  });
});
