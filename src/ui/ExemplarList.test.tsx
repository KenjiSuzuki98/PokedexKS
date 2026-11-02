// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { collection, ex, iv } from '../core/test-helpers';
import { ExemplarList } from './ExemplarList';
import { renderWith } from './test-utils';

const raichu = ex({ speciesId: 'raichu', iv: iv(70), cp: 2000, shiny: true });
const pika = ex({ speciesId: 'pikachu', iv: iv(96), cp: 900 });
const pikaFraco = ex({ speciesId: 'pikachu', iv: iv(40), cp: 500 });
const pikaTroca = ex({ speciesId: 'pikachu', iv: iv(30), cp: 400, origin: 'troca' });
const pikaRuim = ex({ speciesId: 'pikachu', iv: iv(20), cp: 300 });
const c = collection({ exemplars: [raichu, pika, pikaFraco, pikaTroca, pikaRuim] });
const rows = () => screen.getAllByRole('row').slice(1);

describe('ExemplarList', () => {
  it('mostra espécie, CP, IV, status e o ID para renomear', () => {
    renderWith(<ExemplarList onOpen={() => {}} />, c);
    const row = screen.getByRole('row', { name: /Raichu.*2000/ });
    expect(within(row).getByText('70%')).toBeInTheDocument();
    expect(within(row).getByText('manter')).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
  });

  it('reserva aparece como aguardando evolução', () => {
    renderWith(<ExemplarList onOpen={() => {}} />, c);
    const row = screen.getByRole('row', { name: /Pikachu.*900/ });
    expect(within(row).getByText(/aguardando evolução.*Raichu/i)).toBeInTheDocument();
  });

  it('filtra por status (telas Trocas e Descarte)', () => {
    const { unmount } = renderWith(<ExemplarList status="trocar" onOpen={() => {}} />, c);
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole('row', { name: /300/ })).toBeInTheDocument();
    unmount();
    renderWith(<ExemplarList status="descartar" onOpen={() => {}} />, c);
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole('row', { name: /400/ })).toBeInTheDocument();
  });

  it('busca por texto', async () => {
    const { user } = renderWith(<ExemplarList onOpen={() => {}} />, c);
    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'rai');
    expect(rows()).toHaveLength(1);
  });

  it('ordena por dois critérios, crescente ou decrescente', async () => {
    const { user } = renderWith(<ExemplarList onOpen={() => {}} />, c);
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'cp');
    await user.selectOptions(screen.getByLabelText('Direção 1'), 'asc');
    expect(rows().map((r) => within(r).getAllByRole('cell')[1]!.textContent)).toEqual(['300', '400', '500', '900', '2000']);
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'evolucao');
    await user.selectOptions(screen.getByLabelText('Depois por'), 'iv');
    await user.selectOptions(screen.getByLabelText('Direção 2'), 'desc');
    expect(rows().map((r) => within(r).getAllByRole('cell')[1]!.textContent)).toEqual(['900', '500', '400', '300', '2000']);
  });

  it('filtra por atributo', async () => {
    const { user } = renderWith(<ExemplarList onOpen={() => {}} />, c);
    await user.selectOptions(screen.getByLabelText('Filtrar status'), 'trocar');
    expect(rows()).toHaveLength(1);
    await user.selectOptions(screen.getByLabelText('Filtrar status'), '');
    await user.selectOptions(screen.getByLabelText('Filtrar por'), 'brilhante');
    expect(screen.getByLabelText('Valor')).toHaveTextContent(/não.*sim/);
    await user.selectOptions(screen.getByLabelText('Valor'), 'sim');
    expect(rows()).toHaveLength(1);
    await user.selectOptions(screen.getByLabelText('Filtrar por'), 'especie');
    await user.selectOptions(screen.getByLabelText('Valor'), 'Pikachu');
    expect(rows()).toHaveLength(4);
  });

  it('copia o ID de renomeação', async () => {
    const { user } = renderWith(<ExemplarList onOpen={() => {}} />, c);
    const row = screen.getByRole('row', { name: /Raichu.*2000/ });
    await user.click(within(row).getByRole('button', { name: /copiar/i }));
    expect(await navigator.clipboard.readText()).toBe('0026BR');
  });

  it('abre o detalhe ao clicar no exemplar', async () => {
    const onOpen = vi.fn();
    const { user } = renderWith(<ExemplarList onOpen={onOpen} />, c);
    await user.click(screen.getByRole('button', { name: /abrir Raichu/i }));
    expect(onOpen).toHaveBeenCalledWith(raichu.id);
  });
});
