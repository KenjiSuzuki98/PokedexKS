// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { collection, ex } from '../core/test-helpers';
import { ExemplarList } from './ExemplarList';
import { renderWith } from './test-utils';

const stats = (atk: number, def: number, sta: number) => ({ atk, def, sta, percent: Math.round(((atk + def + sta) / 45) * 100) });
const raichu = ex({ speciesId: 'raichu', iv: stats(10, 11, 10), shiny: true });
const pika = ex({ speciesId: 'pikachu', iv: stats(15, 14, 14) });
const pikaFraco = ex({ speciesId: 'pikachu', iv: stats(6, 6, 6) });
const pikaTroca = ex({ speciesId: 'pikachu', iv: stats(4, 5, 5), origin: 'troca' });
const pikaRuim = ex({ speciesId: 'pikachu', iv: stats(3, 3, 3) });
const c = collection({ exemplars: [raichu, pika, pikaFraco, pikaTroca, pikaRuim] });
const rows = () => screen.getAllByRole('row').slice(1);
const ivCol = () => rows().map((r) => within(r).getAllByRole('cell')[2]!.textContent);

describe('ExemplarList', () => {
  it('mostra espécie, Nº, IV com ATK/DEF/PS, status e o ID — sem PC nem data', () => {
    renderWith(<ExemplarList onOpen={() => {}} />, c);
    const row = screen.getByRole('button', { name: /abrir Raichu/i }).closest('tr')!;
    expect(within(row).getByText('69%')).toBeInTheDocument();
    expect(within(row).getByText('10/11/10')).toBeInTheDocument();
    expect(within(row).getByText('0026')).toBeInTheDocument();
    expect(row).toHaveTextContent('0026BR');
    expect(screen.queryByRole('columnheader', { name: /CP|PC|Data/ })).toBeNull();
    expect(rows()).toHaveLength(5);
  });

  it('reserva aparece como aguardando evolução', () => {
    renderWith(<ExemplarList onOpen={() => {}} />, c);
    const row = screen.getByRole('row', { name: /96%/ });
    expect(within(row).getByText(/aguardando evolução.*Raichu/i)).toBeInTheDocument();
  });

  it('quem não entra na Pokédex aparece marcado como troca ou descarte', () => {
    renderWith(<ExemplarList onOpen={() => {}} />, c);
    expect(screen.getByRole('row', { name: /20%/ })).toHaveTextContent(/fora da pokédex.*troca/i);
    expect(screen.getByRole('row', { name: /31%/ })).toHaveTextContent(/fora da pokédex.*descarte/i);
    expect(screen.getByRole('row', { name: /40%/ })).not.toHaveTextContent(/fora da pokédex/i);
  });

  it('busca por texto', async () => {
    const { user } = renderWith(<ExemplarList onOpen={() => {}} />, c);
    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'rai');
    expect(rows()).toHaveLength(1);
  });

  it('ordena por dois critérios, crescente ou decrescente', async () => {
    const { user } = renderWith(<ExemplarList onOpen={() => {}} />, c);
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'iv');
    await user.selectOptions(screen.getByLabelText('Direção 1'), 'asc');
    expect(ivCol()).toEqual(['20%', '31%', '40%', '69%', '96%'].map((p) => expect.stringContaining(p)));
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'evolucao');
    await user.selectOptions(screen.getByLabelText('Depois por'), 'iv');
    await user.selectOptions(screen.getByLabelText('Direção 2'), 'desc');
    expect(ivCol()).toEqual(['96%', '40%', '31%', '20%', '69%'].map((p) => expect.stringContaining(p)));
    expect(screen.getByLabelText('Ordenar por')).not.toHaveTextContent(/^CP$|Data/);
  });

  it('filtra por status e por atributo', async () => {
    const { user } = renderWith(<ExemplarList onOpen={() => {}} />, c);
    await user.selectOptions(screen.getByLabelText('Filtrar status'), 'trocar');
    expect(rows()).toHaveLength(1);
    await user.selectOptions(screen.getByLabelText('Filtrar status'), '');
    await user.selectOptions(screen.getByLabelText('Filtrar por'), 'brilhante');
    await user.selectOptions(screen.getByLabelText('Valor'), 'sim');
    expect(rows()).toHaveLength(1);
  });

  it('copia o ID de renomeação', async () => {
    const { user } = renderWith(<ExemplarList onOpen={() => {}} />, c);
    await user.click(within(screen.getByRole('button', { name: /abrir Raichu/i }).closest('tr')!).getByRole('button', { name: /copiar/i }));
    expect(await navigator.clipboard.readText()).toBe('0026BR');
  });

  it('abre o detalhe ao clicar no exemplar', async () => {
    const onOpen = vi.fn();
    const { user } = renderWith(<ExemplarList onOpen={onOpen} />, c);
    await user.click(screen.getByRole('button', { name: /abrir Raichu/i }));
    expect(onOpen).toHaveBeenCalledWith(raichu.id);
  });
});
