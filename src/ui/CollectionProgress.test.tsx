// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { computeCollection } from '../core/assign';
import { computeProgress } from '../core/progress';
import { collection, ex, iv, pichuLine, species } from '../core/test-helpers';
import { CollectionProgress } from './CollectionProgress';
import { renderWith } from './test-utils';

const progressOf = (c: ReturnType<typeof collection>) => computeProgress(c, computeCollection(c));

describe('CollectionProgress', () => {
  it('geral em barra horizontal com "XX% X/Y"', () => {
    const c = collection({ exemplars: [ex({ speciesId: 'raichu', iv: iv(96) })] });
    const p = progressOf(c).overall;
    renderWith(<CollectionProgress onOpenExemplar={() => {}} />, c);
    const meter = screen.getByRole('meter', { name: 'Geral' });
    expect(meter).toHaveAttribute('aria-valuenow', String(Math.round(p.percent)));
    expect(meter).toHaveTextContent(`${Math.round(p.percent)}% ${p.filled}/${p.total}`);
  });

  it('reservas aparecem separadas', () => {
    const c = collection({ exemplars: [ex({ speciesId: 'pikachu', iv: iv(96) })] });
    const p = progressOf(c).overall;
    renderWith(<CollectionProgress onOpenExemplar={() => {}} />, c);
    expect(screen.getByRole('meter', { name: 'Geral' })).toHaveTextContent(`+${p.reserved} reservadas`);
  });

  it('cards por categoria e por cadeia', () => {
    renderWith(<CollectionProgress onOpenExemplar={() => {}} />);
    expect(screen.getByRole('meter', { name: 'Raridade' })).toHaveTextContent('0% 0/6');
    expect(screen.getByRole('meter', { name: 'Cadeia Pichu' })).toBeInTheDocument();
  });

  it('clicar na cadeia abre as espécies; clicar na espécie abre as vagas com quem ocupa', async () => {
    const pika = ex({ speciesId: 'pikachu', iv: iv(96) });
    const r = renderWith(<CollectionProgress onOpenExemplar={() => {}} />, collection({ exemplars: [pika] }));
    await r.user.click(screen.getByRole('button', { name: /Cadeia Pichu/ }));
    expect(screen.getAllByRole('meter').map((m) => m.getAttribute('aria-label'))).toEqual(['Cadeia Pichu', 'Pichu', 'Pikachu', 'Raichu']);

    await r.user.click(screen.getByRole('button', { name: /^Raichu/ }));
    const ev = screen.getByRole('row', { name: /0026EV/ });
    expect(ev).toHaveTextContent(/reservado.*Pikachu.*96%/i);
    expect(screen.getByRole('row', { name: /0026XXL/ })).toHaveTextContent(/falta/i);

    await r.user.click(screen.getByRole('button', { name: /voltar/i }));
    expect(screen.getByRole('meter', { name: 'Pikachu' })).toBeInTheDocument();
    await r.user.click(screen.getByRole('button', { name: /voltar/i }));
    expect(screen.getByRole('meter', { name: 'Geral' })).toBeInTheDocument();
  });

  it('lista de vagas da categoria, com filtro "só o que falta"', async () => {
    const shiny = ex({ speciesId: 'raichu', iv: iv(50), shiny: true });
    const r = renderWith(<CollectionProgress onOpenExemplar={() => {}} />, collection({ exemplars: [shiny] }));
    await r.user.click(screen.getByRole('button', { name: /Raridade/ }));
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(6);
    await r.user.click(screen.getByLabelText(/só o que falta/i));
    const ids = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]!.textContent);
    expect(ids).not.toContain('0026BR');
    expect(ids).toHaveLength(5);
  });

  it('clicar no ocupante abre o exemplar', async () => {
    const shiny = ex({ speciesId: 'raichu', iv: iv(50), shiny: true });
    const onOpen = vi.fn();
    const r = renderWith(<CollectionProgress onOpenExemplar={onOpen} />, collection({ exemplars: [shiny] }));
    await r.user.click(screen.getByRole('button', { name: /Raridade/ }));
    await r.user.click(within(screen.getByRole('row', { name: /0026BR/ })).getByRole('button', { name: /Raichu/ }));
    expect(onOpen).toHaveBeenCalledWith(shiny.id);
  });

  it('busca de cadeia por nome ou Nº de qualquer fase', async () => {
    const sp = [...pichuLine, species({ id: 'magnemite', name: 'Magnemite', dex: 81 })];
    const r = renderWith(<CollectionProgress onOpenExemplar={() => {}} />, collection({ species: sp }));
    await r.user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'raichu');
    expect(screen.queryByRole('meter', { name: 'Cadeia Magnemite' })).toBeNull();
    expect(screen.getByRole('meter', { name: 'Cadeia Pichu' })).toBeInTheDocument();
    await r.user.clear(screen.getByRole('searchbox', { name: /buscar/i }));
    await r.user.type(screen.getByRole('searchbox', { name: /buscar/i }), '81');
    expect(screen.getByRole('meter', { name: 'Cadeia Magnemite' })).toBeInTheDocument();
    expect(screen.queryByRole('meter', { name: 'Cadeia Pichu' })).toBeNull();
    await r.user.clear(screen.getByRole('searchbox', { name: /buscar/i }));
    await r.user.type(screen.getByRole('searchbox', { name: /buscar/i }), '0026BR');
    expect(screen.getByRole('meter', { name: 'Cadeia Pichu' })).toBeInTheDocument();
    expect(screen.queryByRole('meter', { name: 'Cadeia Magnemite' })).toBeNull();
  });

  it('novas vagas abertas aparecem e podem ser marcadas como vistas', async () => {
    const sp = pichuLine.map((s) => (s.id === 'raichu' ? { ...s, mega: true } : s));
    const r = renderWith(<CollectionProgress onOpenExemplar={() => {}} />, collection({ species: sp, openedSlots: ['0026MG'] }));
    const box = screen.getByRole('region', { name: /novas vagas abertas/i });
    expect(within(box).getByText(/0026MG/)).toBeInTheDocument();
    await r.user.click(within(box).getByRole('button', { name: /marcar como vistas/i }));
    expect(r.collection.openedSlots).toEqual([]);
  });

  describe('ordenar e filtrar cadeias', () => {
    const sp = [...pichuLine, species({ id: 'magnemite', name: 'Magnemite', dex: 81 }), species({ id: 'treecko', name: 'Treecko', dex: 252 })];
    const col = collection({
      species: sp,
      exemplars: [
        ex({ speciesId: 'raichu', iv: iv(90), addedAt: '2026-01-01T00:00:00Z' }),
        ex({ speciesId: 'magnemite', iv: iv(50), addedAt: '2026-11-01T00:00:00Z' }),
      ],
    });
    const chainNames = () =>
      screen.getAllByRole('meter').map((m) => m.getAttribute('aria-label') ?? '').filter((n) => n.startsWith('Cadeia '));

    it('filtros ficam atrás do 🔎; com filtro ativo aparece o 🧹', async () => {
      const r = renderWith(<CollectionProgress onOpenExemplar={() => {}} />, col);
      expect(screen.queryByLabelText('Ordenar cadeias por')).toBeNull();
      await r.user.click(screen.getByRole('button', { name: 'Filtrar' }));
      await r.user.selectOptions(screen.getByLabelText('Situação'), 'vazias');
      expect(chainNames()).toEqual(['Cadeia Treecko']);
      await r.user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
      expect(chainNames()).toHaveLength(3);
    });

    it('ordena por inclusão (recentes ou antigos primeiro) e filtra por região', async () => {
      const r = renderWith(<CollectionProgress onOpenExemplar={() => {}} />, col);
      await r.user.click(screen.getByRole('button', { name: 'Filtrar' }));
      await r.user.selectOptions(screen.getByLabelText('Ordenar cadeias por'), 'inclusao');
      await r.user.selectOptions(screen.getByLabelText('Direção'), 'desc');
      expect(chainNames()).toEqual(['Cadeia Magnemite', 'Cadeia Pichu', 'Cadeia Treecko']);
      await r.user.selectOptions(screen.getByLabelText('Direção'), 'asc');
      expect(chainNames()[0]).toBe('Cadeia Pichu');
      await r.user.selectOptions(screen.getByLabelText('Região'), 'Hoenn');
      expect(chainNames()).toEqual(['Cadeia Treecko']);
    });

    it('lista de vagas: ordena pelas inclusões mais recentes', async () => {
      const r = renderWith(<CollectionProgress onOpenExemplar={() => {}} />, col);
      await r.user.click(screen.getByRole('meter', { name: 'Geral' }));
      await r.user.selectOptions(screen.getByLabelText('Ordenar vagas'), 'recentes');
      const first = screen.getAllByRole('row')[1]!;
      expect(first).toHaveTextContent('0081');
    });
  });
});
