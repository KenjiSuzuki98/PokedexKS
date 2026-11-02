// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { generateSlots } from '../core/slots';
import { collection } from '../core/test-helpers';
import type { GameEvent } from '../core/types';
import { Timeline } from './Timeline';
import { renderWith } from './test-utils';

const ev = (id: string, start: string, active = true): GameEvent => ({
  id, name: `Evento ${id}`, start, end: start, description: '', active, brings: {},
});

describe('Timeline', () => {
  it('cadastra evento futuro sem gerar vagas e depois ativa', async () => {
    const r = renderWith(<Timeline />);
    const before = generateSlots(r.collection).length;
    const form = screen.getByRole('form', { name: 'Novo evento' });
    await r.user.type(within(form).getByLabelText('Nome'), 'Halloween');
    await r.user.type(within(form).getByLabelText('Início'), '2026-10-20');
    await r.user.type(within(form).getByLabelText('Fim'), '2026-10-31');
    await r.user.selectOptions(within(form).getByLabelText('Espécie do traje'), 'pikachu');
    await r.user.type(within(form).getByLabelText('Nome do traje'), 'Bruxa');
    await r.user.click(within(form).getByLabelText('Traje tem brilhante'));
    await r.user.click(within(form).getByRole('button', { name: 'Incluir traje' }));
    expect(within(form).getByText(/Pikachu: Bruxa/)).toBeInTheDocument();
    await r.user.click(within(form).getByRole('button', { name: 'Cadastrar evento' }));

    expect(generateSlots(r.collection)).toHaveLength(before);
    const item = screen.getByRole('article', { name: /Halloween/ });
    expect(item).toHaveTextContent(/não ativado/i);

    await r.user.click(within(item).getByRole('button', { name: 'Ativar' }));
    expect(generateSlots(r.collection)).toHaveLength(before + 2);
    expect(r.collection.openedSlots).toEqual(['0025TBRUX', '0025BTBRUX']);
    expect(screen.getByRole('article', { name: /Halloween/ })).toHaveTextContent(/2 vagas abertas.*0 preenchidas.*faltam 2/i);
  });

  it('registra fundo, estreia de brilhante e forma', async () => {
    const r = renderWith(<Timeline />);
    const form = screen.getByRole('form', { name: 'Novo evento' });
    await r.user.type(within(form).getByLabelText('Nome'), 'Fest');
    await r.user.type(within(form).getByLabelText('Início'), '2026-07-01');
    await r.user.type(within(form).getByLabelText('Nome do fundo'), 'GO Fest');
    await r.user.selectOptions(within(form).getByLabelText('Tipo do fundo'), 'especial');
    await r.user.click(within(form).getByRole('button', { name: 'Incluir fundo' }));
    await r.user.selectOptions(within(form).getByLabelText('Espécie da forma'), 'raichu');
    await r.user.selectOptions(within(form).getByLabelText('Forma'), 'gigamax');
    await r.user.click(within(form).getByRole('button', { name: 'Incluir forma' }));
    await r.user.click(within(form).getByLabelText('Ativar agora'));
    await r.user.click(within(form).getByRole('button', { name: 'Cadastrar evento' }));
    const ids = generateSlots(r.collection).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['0026GX', '0025FS1', '0172FS1']));
  });

  it('ordena por data e filtra por período', async () => {
    const r = renderWith(<Timeline />, collection({ events: [ev('b', '2026-06-01'), ev('a', '2026-01-01')] }));
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Evento a', 'Evento b']);
    await r.user.type(screen.getByLabelText('De'), '2026-03-01');
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Evento b']);
  });
});
