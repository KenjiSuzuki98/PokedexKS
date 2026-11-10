// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { collection, ex, iv } from '../core/test-helpers';
import type { Collection } from '../core/types';
import type { Store } from '../storage/store';
import { App } from './App';

function fakeStore(c: Collection) {
  const save = vi.fn(async (_: Collection) => {});
  const store: Store = { load: async () => c, loadOrSeed: async () => c, save };
  return { store, save };
}

const keep = ex({ speciesId: 'raichu', iv: iv(90) });
const trade = ex({ speciesId: 'raichu', iv: iv(10) });

describe('App', () => {
  it('abre na Coleção (página principal)', async () => {
    render(<App store={fakeStore(collection({ exemplars: [keep, trade] })).store} />);
    expect(await screen.findByRole('heading', { name: 'Coleção' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Geral' })).toBeInTheDocument();
  });

  it('navega entre as telas', async () => {
    const user = userEvent.setup();
    render(<App store={fakeStore(collection({ exemplars: [keep, trade] })).store} />);
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getAllByRole('button').map((b) => b.textContent!.replace(/ \(\d+\)$/, ''))).toEqual([
      'Coleção', 'Meus Pokémon', 'Renomeações', 'Espécies', 'Linha do tempo', 'Dados',
    ]);
    for (const tela of ['Meus Pokémon', 'Renomeações', 'Espécies', 'Linha do tempo', 'Dados', 'Coleção']) {
      await user.click(within(nav).getByRole('button', { name: new RegExp(`^${tela}`) }));
      expect(screen.getByRole('heading', { name: tela })).toBeInTheDocument();
    }
  });

  it('renomeações pendentes aparecem como contador na navegação', async () => {
    render(<App store={fakeStore(collection({ exemplars: [keep, trade] })).store} />);
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getByRole('button', { name: /Renomeações \(1\)/ })).toBeInTheDocument();
  });

  it('cadastrar exemplar salva no armazenamento e abre o detalhe', async () => {
    const user = userEvent.setup();
    const { store, save } = fakeStore(collection());
    render(<App store={store} />);
    await user.click(await screen.findByRole('button', { name: /novo exemplar/i }));
    await user.type(screen.getByRole('combobox', { name: 'Pokémon' }), 'Raichu');
    for (const label of ['ATK', 'DEF', 'PS']) fireEvent.change(screen.getByLabelText(label), { target: { value: '15' } });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(save).toHaveBeenCalled();
    expect(save.mock.calls.at(-1)![0].exemplars).toHaveLength(1);
    expect(screen.getByText(/renomear para/i)).toHaveTextContent('0026EV');
  });

  it('abre o detalhe a partir da lista e volta', async () => {
    const user = userEvent.setup();
    render(<App store={fakeStore(collection({ exemplars: [keep] })).store} />);
    const nav = await screen.findByRole('navigation');
    await user.click(within(nav).getByRole('button', { name: /^Meus Pokémon/ }));
    await user.click(screen.getByRole('button', { name: /abrir Raichu/i }));
    expect(screen.getByRole('heading', { name: /Raichu/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /voltar/i }));
    expect(screen.getByRole('heading', { name: 'Meus Pokémon' })).toBeInTheDocument();
  });

  it('da Coleção, clicar num ocupante abre o exemplar', async () => {
    const user = userEvent.setup();
    render(<App store={fakeStore(collection({ exemplars: [keep] })).store} />);
    await user.click(await screen.findByRole('button', { name: /^Evolução/ }));
    await user.click(screen.getByRole('button', { name: /Raichu 90%/ }));
    expect(screen.getByRole('heading', { name: /Raichu/ })).toBeInTheDocument();
  });
});
