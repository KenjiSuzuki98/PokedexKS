// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { generateSlots } from '../core/slots';
import { collection } from '../core/test-helpers';
import { SpeciesTable } from './SpeciesTable';
import { renderWith } from './test-utils';

const row = (name: RegExp) => screen.getByRole('rowheader', { name }).closest('tr')!;

describe('SpeciesTable', () => {
  it('lista as espécies com Nº e marcações', () => {
    renderWith(<SpeciesTable />);
    expect(row(/^Pikachu$/)).toHaveTextContent('25');
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('marcar Mega cria a vaga e abre como nova vaga', async () => {
    const r = renderWith(<SpeciesTable />);
    await r.user.click(within(row(/^Raichu$/)).getByRole('checkbox', { name: 'Mega' }));
    expect(r.collection.species.find((s) => s.id === 'raichu')!.mega).toBe(true);
    expect(r.collection.openedSlots).toContain('0026MG');
  });

  it('muda a regra de sexo da espécie', async () => {
    const r = renderWith(<SpeciesTable />);
    await r.user.selectOptions(within(row(/^Pichu$/)).getByRole('combobox', { name: 'Sexo' }), 'sem');
    expect(r.collection.species.find((s) => s.id === 'pichu')!.gender).toBe('sem');
  });

  it('edita atributos base', async () => {
    const r = renderWith(<SpeciesTable />);
    await r.user.click(within(row(/^Pikachu$/)).getByRole('button', { name: 'Editar' }));
    const atk = screen.getByLabelText('Ataque base');
    await r.user.clear(atk);
    await r.user.type(atk, '120');
    await r.user.click(screen.getByRole('button', { name: 'Salvar espécie' }));
    expect(r.collection.species.find((s) => s.id === 'pikachu')!.base.atk).toBe(120);
  });

  it('adiciona traje novo (e a versão brilhante)', async () => {
    const r = renderWith(<SpeciesTable />);
    const form = screen.getByRole('form', { name: 'Novo traje' });
    await r.user.selectOptions(within(form).getByLabelText('Espécie'), 'pikachu');
    await r.user.type(within(form).getByLabelText('Nome'), 'Festa');
    await r.user.click(within(form).getByLabelText('Tem brilhante'));
    await r.user.click(within(form).getByRole('button', { name: 'Adicionar traje' }));
    expect(generateSlots(r.collection).map((s) => s.id)).toEqual(expect.arrayContaining(['0025TFEST', '0025BTFEST']));
    expect(row(/^Pikachu$/)).toHaveTextContent('Festa');
  });

  it('adiciona espécie nova e avisa se o ID de vaga colidir', async () => {
    const r = renderWith(<SpeciesTable />);
    const form = screen.getByRole('form', { name: 'Nova espécie' });
    await r.user.type(within(form).getByLabelText('Nome'), 'Raichu de Alola');
    await r.user.type(within(form).getByLabelText('Nº Pokédex'), '26');
    await r.user.type(within(form).getByLabelText('Forma'), 'A');
    await r.user.selectOptions(within(form).getByLabelText('Evolui de'), 'pikachu');
    await r.user.click(within(form).getByRole('button', { name: 'Adicionar espécie' }));
    expect(r.collection.species.find((s) => s.name === 'Raichu de Alola')).toMatchObject({ dex: 26, form: 'A', evolvesFrom: 'pikachu' });

    await r.user.type(within(form).getByLabelText('Nome'), 'Outro');
    await r.user.type(within(form).getByLabelText('Nº Pokédex'), '25');
    await r.user.click(within(form).getByRole('button', { name: 'Adicionar espécie' }));
    expect(screen.getByRole('alert')).toHaveTextContent('0025EV');
  });

  it('cria categoria de vaga nova', async () => {
    const r = renderWith(<SpeciesTable />, collection());
    const form = screen.getByRole('form', { name: 'Nova categoria' });
    await r.user.type(within(form).getByLabelText('Nome'), 'Chapéu');
    await r.user.type(within(form).getByLabelText(/valores/i), 'Com chapéu:CH');
    await r.user.click(within(form).getByRole('button', { name: 'Criar categoria' }));
    expect(generateSlots(r.collection).map((s) => s.id)).toEqual(expect.arrayContaining(['0025CH', '0026CH', '0172CH']));
  });
});
