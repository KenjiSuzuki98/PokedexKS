// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { activateEvent, addEvent } from '../core/events';
import { generateSlots } from '../core/slots';
import { collection, ex, pichuLine } from '../core/test-helpers';
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
    await r.user.type(within(form).getByRole('combobox', { name: 'Espécie do traje' }), 'Pikachu');
    await r.user.type(within(form).getByLabelText('Nome do traje'), 'Bruxa');
    await r.user.click(within(form).getByLabelText('Traje tem brilhante'));
    await r.user.click(within(form).getByLabelText('Também nas evoluções'));
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
    await r.user.type(within(form).getByRole('combobox', { name: 'Espécie da forma' }), 'Raichu');
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

  it('traje incluído vale também para as evoluções (mesmo traje na cadeia)', async () => {
    const r = renderWith(<Timeline />);
    const form = screen.getByRole('form', { name: 'Novo evento' });
    await r.user.type(within(form).getByLabelText('Nome'), 'Thunder');
    await r.user.type(within(form).getByLabelText('Início'), '2025-06-01');
    await r.user.type(within(form).getByRole('combobox', { name: 'Espécie do traje' }), 'Pikachu');
    await r.user.type(within(form).getByLabelText('Nome do traje'), 'Boina');
    expect(within(form).getByLabelText('Também nas evoluções')).toBeChecked();
    await r.user.click(within(form).getByRole('button', { name: 'Incluir traje' }));
    await r.user.click(within(form).getByLabelText('Ativar agora'));
    await r.user.click(within(form).getByRole('button', { name: 'Cadastrar evento' }));
    const costumes = (id: string) => r.collection.species.find((s) => s.id === id)!.costumes.map((t) => t.id);
    expect(costumes('pikachu')).toEqual(['boina']);
    expect(costumes('raichu')).toEqual(['boina']);
  });

  it('não deixa incluir traje que a espécie já tem', async () => {
    const withBoina = activateEvent(
      addEvent(collection(), {
        ...ev('ev1', '2025-06-01', false),
        name: 'Thunder',
        brings: { costumes: [{ speciesId: 'pikachu', name: 'Boina', shiny: false }] },
      }),
      'ev1',
    ).collection;
    const r = renderWith(<Timeline />, withBoina);
    const form = screen.getByRole('form', { name: 'Novo evento' });
    await r.user.type(within(form).getByRole('combobox', { name: 'Espécie do traje' }), 'Pikachu');
    await r.user.type(within(form).getByLabelText('Nome do traje'), 'boina');
    await r.user.click(within(form).getByRole('button', { name: 'Incluir traje' }));
    expect(within(form).getByRole('alert')).toHaveTextContent(/Pikachu já tem o traje Boina.*Thunder/);
    expect(within(form).queryByText(/Pikachu: boina/)).toBeNull();
  });

  describe('editar e excluir', () => {
    const active = () =>
      activateEvent(
        addEvent(collection(), {
          ...ev('ev1', '2025-06-01', false),
          name: 'Thunder',
          brings: {
            costumes: [
              { speciesId: 'pikachu', name: 'Boina', shiny: false },
              { speciesId: 'raichu', name: 'Boina', shiny: false },
            ],
          },
        }),
        'ev1',
      ).collection;

    it('edita nome do evento e do traje sem mudar o código do traje', async () => {
      const r = renderWith(<Timeline />, active());
      await r.user.click(within(screen.getByRole('article', { name: 'Thunder' })).getByRole('button', { name: 'Editar' }));
      const form = screen.getByRole('form', { name: 'Editar Thunder' });
      const name = within(form).getByLabelText('Nome');
      await r.user.clear(name);
      await r.user.type(name, 'Pikachu Thunder');
      const costume = within(form).getByLabelText('Nome do traje de Pikachu');
      await r.user.clear(costume);
      await r.user.type(costume, 'Boina Preta');
      await r.user.click(within(form).getByRole('button', { name: 'Salvar evento' }));
      expect(r.collection.events[0]!.name).toBe('Pikachu Thunder');
      expect(r.collection.species.find((s) => s.id === 'pikachu')!.costumes[0]).toMatchObject({
        id: 'boina', code: 'BOIN', name: 'Boina Preta',
      });
      expect(screen.getByRole('article', { name: 'Pikachu Thunder' })).toBeInTheDocument();
    });

    it('tira um traje do evento; se estiver em uso, avisa e não muda nada', async () => {
      const r = renderWith(<Timeline />, { ...active(), exemplars: [ex({ speciesId: 'raichu', costumeId: 'boina' })] });
      await r.user.click(within(screen.getByRole('article', { name: 'Thunder' })).getByRole('button', { name: 'Editar' }));
      const form = screen.getByRole('form', { name: 'Editar Thunder' });
      await r.user.click(within(form).getByRole('button', { name: 'Tirar Traje Raichu: Boina' }));
      await r.user.click(within(form).getByRole('button', { name: 'Salvar evento' }));
      expect(within(form).getByRole('alert')).toHaveTextContent(/em uso/);
      expect(r.collection.species.find((s) => s.id === 'raichu')!.costumes).toHaveLength(1);
    });

    it('exclui o evento (com confirmação) e desfaz as vagas dele', async () => {
      const r = renderWith(<Timeline />, active());
      const item = screen.getByRole('article', { name: 'Thunder' });
      await r.user.click(within(item).getByRole('button', { name: 'Excluir' }));
      expect(r.collection.events).toHaveLength(1);
      await r.user.click(within(item).getByRole('button', { name: 'Confirmar exclusão' }));
      expect(r.collection.events).toEqual([]);
      expect(r.collection.species.every((s) => s.costumes.length === 0)).toBe(true);
    });
  });

  it('trajes sem evento (antigos em uso) podem ser renomeados', async () => {
    const sp = pichuLine.map((s) =>
      s.id === 'pikachu' ? { ...s, costumes: [{ id: 'pikachu-festa', code: 'FEST', name: 'Festa', shiny: false }] } : s,
    );
    const r = renderWith(<Timeline />, collection({ species: sp }));
    const box = screen.getByRole('region', { name: /trajes sem evento/i });
    const name = within(box).getByLabelText('Nome do traje Festa (Pikachu)');
    await r.user.clear(name);
    await r.user.type(name, 'Festa 2019');
    await r.user.click(within(box).getByRole('button', { name: 'Salvar traje Festa (Pikachu)' }));
    expect(r.collection.species.find((s) => s.id === 'pikachu')!.costumes[0]).toMatchObject({ code: 'FEST', name: 'Festa 2019' });
  });
});
