import { calculateIV, cpFor, hpFor, levelsForDust, refineByAppraisal, starsFor, toIV } from './calc';

const pikachu = { atk: 112, def: 96, sta: 111 };

describe('fórmulas', () => {
  it('CP e PS do Pikachu 15/15/15 no nível 20', () => {
    expect(cpFor(pikachu, { atk: 15, def: 15, sta: 15 }, 20)).toBe(536);
    expect(hpFor(pikachu, 15, 20)).toBe(75);
  });

  it('poeira estelar define a faixa de nível', () => {
    expect(levelsForDust(2500, true)).toEqual([19, 19.5, 20, 20.5]);
    expect(levelsForDust(2500, false)).toEqual([19, 20]);
    expect(levelsForDust(200, false)).toEqual([1, 2]);
  });

  it('custo de poeira de sortudo/sombroso/purificado é convertido para o custo base', () => {
    expect(levelsForDust(1250, false, 'sortudo')).toEqual([19, 20]);
    expect(levelsForDust(3000, false, 'sombroso')).toEqual([19, 20]);
    expect(levelsForDust(2250, false, 'purificado')).toEqual([19, 20]);
  });
});

describe('calculateIV', () => {
  it('encontra todas as combinações e a faixa de IV%', () => {
    const r = calculateIV({ base: pikachu, cp: 536, hp: 75, dust: 2500, poweredUp: false });
    expect(r.combos).toContainEqual({ level: 20, atk: 15, def: 15, sta: 15, percent: 100 });
    for (const c of r.combos) {
      expect(cpFor(pikachu, c, c.level)).toBe(536);
      expect(hpFor(pikachu, c.sta, c.level)).toBe(75);
    }
    expect(r.max).toBe(100);
    expect(r.min).toBe(Math.min(...r.combos.map((c) => c.percent)));
  });

  it('sem combinação possível devolve lista vazia', () => {
    const r = calculateIV({ base: pikachu, cp: 5000, hp: 75, dust: 2500, poweredUp: false });
    expect(r.combos).toEqual([]);
  });

  it('refino pela avaliação reduz as combinações', () => {
    const r = calculateIV({ base: pikachu, cp: 500, hp: 72, dust: 2500, poweredUp: true });
    expect(r.combos.length).toBeGreaterThan(1);
    const refined = refineByAppraisal(r, { stars: 3, bars: { atk: 3 } });
    expect(refined.combos.length).toBeLessThan(r.combos.length);
    for (const c of refined.combos) {
      expect(c.atk).toBe(15);
      expect(starsFor(c.atk + c.def + c.sta)).toBe(3);
    }
  });

  it('estrelas da avaliação', () => {
    expect([0, 22, 23, 29, 30, 36, 37, 44, 45].map(starsFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
  });

  it('faixa vira IV estimado com valor médio; combinação única vira IV exato', () => {
    const many = calculateIV({ base: pikachu, cp: 500, hp: 72, dust: 2500, poweredUp: true });
    const est = toIV(many)!;
    expect(est.estimated).toBe(true);
    expect(est.percent).toBeCloseTo(many.combos.reduce((s, c) => s + c.percent, 0) / many.combos.length);
    expect(toIV({ combos: [{ level: 20, atk: 15, def: 14, sta: 15, percent: 98 }], min: 98, max: 98 })).toEqual({
      atk: 15, def: 14, sta: 15, percent: 98,
    });
    expect(toIV({ combos: [], min: 0, max: 0 })).toBeNull();
  });
});
