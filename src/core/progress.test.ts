import { computeCollection } from './assign';
import { activateEvent, addEvent } from './events';
import { computeProgress, timeline } from './progress';
import { collection, ex, iv } from './test-helpers';

describe('progresso', () => {
  it('conta preenchidas e reservadas separadamente, em x/y e %', () => {
    const p = ex({ speciesId: 'pikachu', iv: iv(96) });
    const c = collection({ exemplars: [p] });
    const prog = computeProgress(c, computeCollection(c));
    const raichu = prog.bySpecies['raichu']!;
    expect(raichu.filled).toBe(0);
    expect(raichu.reserved).toBeGreaterThan(0);
    expect(raichu.total).toBe(computeCollection(c).slots.filter((s) => s.speciesId === 'raichu').length);
    expect(prog.byChain['pichu']!.total).toBe(prog.overall.total);
    expect(prog.byCategory['evolucao']).toEqual({ filled: 0, reserved: 1, total: 3, percent: 0 });
  });

  it('exemplar já na fase conta como preenchido', () => {
    const r = ex({ speciesId: 'raichu', iv: iv(96) });
    const c = collection({ exemplars: [r] });
    const ev = computeProgress(c, computeCollection(c)).byCategory['evolucao']!;
    expect(ev.filled).toBe(1);
    expect(ev.percent).toBeCloseTo(33.33, 1);
  });

  it('é recalculado quando entram vagas novas', () => {
    const r = ex({ speciesId: 'raichu', iv: iv(96) });
    const c0 = addEvent(collection({ exemplars: [r] }), {
      id: 'ev', name: 'Ev', start: '2026-10-01', end: '2026-10-02', description: '', active: false,
      brings: { costumes: [{ speciesId: 'raichu', name: 'Capa', shiny: false }] },
    });
    const before = computeProgress(c0, computeCollection(c0)).overall;
    const c1 = activateEvent(c0, 'ev').collection;
    const after = computeProgress(c1, computeCollection(c1)).overall;
    expect(after.total).toBe(before.total + 1);
    expect(after.filled).toBe(before.filled);
    expect(after.percent).toBeLessThan(before.percent);
  });
});

describe('linha do tempo', () => {
  it('lista eventos por data com vagas abertas, preenchidas e faltando, com filtro', () => {
    let c = collection();
    for (const [id, start, name] of [['b', '2026-06-01', 'Capa'], ['a', '2026-01-01', 'Gorro']] as const) {
      c = addEvent(c, {
        id, name: id, start, end: start, description: '', active: false,
        brings: { costumes: [{ speciesId: 'raichu', name, shiny: false }] },
      });
      c = activateEvent(c, id).collection;
    }
    const gorro = c.species.find((s) => s.id === 'raichu')!.costumes.find((t) => t.name === 'Gorro')!;
    c = { ...c, exemplars: [ex({ speciesId: 'raichu', iv: iv(50), costumeId: gorro.id })] };
    const r = computeCollection(c);

    const t = timeline(c, r);
    expect(t.map((x) => x.event.id)).toEqual(['a', 'b']);
    expect(t[0]).toMatchObject({ opened: 1, filled: 1, missing: 0 });
    expect(t[1]).toMatchObject({ opened: 1, filled: 0, missing: 1 });
    expect(timeline(c, r, { from: '2026-03-01' }).map((x) => x.event.id)).toEqual(['b']);
  });
});
