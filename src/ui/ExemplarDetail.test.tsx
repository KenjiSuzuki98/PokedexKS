// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { computeCollection } from '../core/assign';
import { collection, ex, iv } from '../core/test-helpers';
import { ExemplarDetail } from './ExemplarDetail';
import { RenamePending } from './RenamePending';
import { renderWith } from './test-utils';

describe('ExemplarDetail', () => {
  const shiny = ex({ speciesId: 'raichu', iv: iv(70), shiny: true, size: 'xxl' });
  const pika = ex({ speciesId: 'pikachu', iv: iv(96) });
  const c = collection({ exemplars: [shiny, pika] });

  it('mostra status, vagas ocupadas e o ID para renomear com botão de copiar', async () => {
    const { user } = renderWith(<ExemplarDetail id={shiny.id} onClose={() => {}} />, c);
    expect(screen.getByRole('heading', { name: /Raichu/ })).toBeInTheDocument();
    expect(screen.getByText(/renomear para/i)).toHaveTextContent('0026BR');
    const slots = screen.getByRole('list', { name: /vagas/i });
    expect(within(slots).getByText(/0026BR/)).toBeInTheDocument();
    expect(within(slots).getByText(/0026XXL/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /copiar 0026BR/i }));
    expect(await navigator.clipboard.readText()).toBe('0026BR');
  });

  it('reserva mostra para qual evolução está guardada', () => {
    renderWith(<ExemplarDetail id={pika.id} onClose={() => {}} />, c);
    expect(screen.getByText(/aguardando evolução.*Raichu/i)).toBeInTheDocument();
  });

  it('"Já renomeei" grava o apelido e tira das pendências', async () => {
    const r = renderWith(<ExemplarDetail id={shiny.id} onClose={() => {}} />, c);
    await r.user.click(screen.getByRole('button', { name: /já renomeei/i }));
    expect(r.collection.exemplars.find((e) => e.id === shiny.id)!.nickname).toBe('0026BR');
    expect(screen.queryByRole('button', { name: /já renomeei/i })).toBeNull();
  });

  it('editar abre o formulário e salvar recalcula', async () => {
    const r = renderWith(<ExemplarDetail id={shiny.id} onClose={() => {}} />, c);
    await r.user.click(screen.getByRole('button', { name: 'Editar' }));
    await r.user.click(screen.getByLabelText('Brilhante'));
    await r.user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText(/renomear para/i)).toHaveTextContent('0026XXL');
  });

  it('excluir pede confirmação e remove', async () => {
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const r = renderWith(<ExemplarDetail id={shiny.id} onClose={onClose} />, c);
    await r.user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(confirm).toHaveBeenCalled();
    expect(r.collection.exemplars.map((e) => e.id)).toEqual([pika.id]);
    expect(onClose).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('mostra Nº, região e ATK/DEF/PS, sem PC', () => {
    const e = ex({ speciesId: 'raichu', cp: 1234, iv: { atk: 15, def: 14, sta: 14, percent: 96 } });
    renderWith(<ExemplarDetail id={e.id} onClose={() => {}} />, collection({ exemplars: [e] }));
    const h = screen.getByRole('heading', { name: /Raichu/ });
    expect(h).toHaveTextContent(/0026.*Kanto.*96%.*15\/14\/14/);
    expect(screen.queryByText(/CP|PC 1234|1234/)).toBeNull();
  });

  it('quem não entra na Pokédex mostra troca ou descarte', () => {
    const best = ex({ speciesId: 'raichu', iv: iv(99) });
    const worse = ex({ speciesId: 'raichu', iv: iv(10), origin: 'troca' });
    renderWith(<ExemplarDetail id={worse.id} onClose={() => {}} />, collection({ exemplars: [best, worse] }));
    expect(screen.getByText(/fora da pokédex.*descarte/i)).toBeInTheDocument();
    expect(screen.queryByText(/renomear para/i)).toBeNull();
  });

  it('exemplar inexistente', () => {
    renderWith(<ExemplarDetail id="nada" onClose={() => {}} />, c);
    expect(screen.getByText(/não encontrado/i)).toBeInTheDocument();
  });
});

describe('RenamePending', () => {
  it('lista quem precisa de apelido novo e "Feito" resolve', async () => {
    const a = ex({ speciesId: 'raichu', iv: iv(80), nickname: '0026EV' });
    const b = ex({ speciesId: 'raichu', iv: iv(95) });
    const c = collection({ exemplars: [a, b] });
    const r = renderWith(<RenamePending />, c);
    const rowA = screen.getByRole('row', { name: /0026EV.*remover apelido/i });
    const rowB = screen.getByRole('row', { name: /sem apelido.*0026EV/i });
    await r.user.click(within(rowB).getByRole('button', { name: 'Feito' }));
    await r.user.click(within(rowA).getByRole('button', { name: 'Feito' }));
    expect(computeCollection(r.collection).renamePending).toEqual([]);
    expect(screen.getByText(/nenhuma renomeação pendente/i)).toBeInTheDocument();
  });
});
