// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { computeCollection } from '../core/assign';
import { computeProgress } from '../core/progress';
import { collection, ex, iv, pichuLine } from '../core/test-helpers';
import { CollectionProgress } from './CollectionProgress';
import { renderWith } from './test-utils';

const progressOf = (c: ReturnType<typeof collection>) => computeProgress(c, computeCollection(c));

describe('CollectionProgress', () => {
  it('mostra o geral em gauge (%) e x/y', () => {
    const c = collection({ exemplars: [ex({ speciesId: 'raichu', iv: iv(96) })] });
    const p = progressOf(c).overall;
    renderWith(<CollectionProgress />, c);
    const meter = screen.getByRole('meter', { name: 'Geral' });
    expect(meter).toHaveAttribute('aria-valuenow', String(Math.round(p.percent)));
    expect(meter).toHaveTextContent(`${p.filled}/${p.total}`);
    expect(meter).toHaveTextContent(`${Math.round(p.percent)}%`);
  });

  it('reservas aparecem separadas', () => {
    const c = collection({ exemplars: [ex({ speciesId: 'pikachu', iv: iv(96) })] });
    const p = progressOf(c).overall;
    renderWith(<CollectionProgress />, c);
    expect(screen.getByRole('meter', { name: 'Geral' })).toHaveTextContent(`mais ${p.reserved} reservadas`);
  });

  it('progresso por cadeia, por espécie e por categoria', () => {
    renderWith(<CollectionProgress />, collection());
    expect(screen.getByRole('meter', { name: 'Cadeia Pichu' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Raichu' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Raridade' })).toHaveTextContent('0/6');
  });

  it('novas vagas abertas aparecem e podem ser marcadas como vistas', async () => {
    const species = pichuLine.map((s) => (s.id === 'raichu' ? { ...s, mega: true } : s));
    const r = renderWith(<CollectionProgress />, collection({ species, openedSlots: ['0026MG'] }));
    const box = screen.getByRole('region', { name: /novas vagas abertas/i });
    expect(within(box).getByText(/0026MG/)).toBeInTheDocument();
    await r.user.click(within(box).getByRole('button', { name: /marcar como vistas/i }));
    expect(r.collection.openedSlots).toEqual([]);
    expect(screen.queryByRole('region', { name: /novas vagas abertas/i })).toBeNull();
  });
});
