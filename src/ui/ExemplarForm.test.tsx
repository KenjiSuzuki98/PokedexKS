// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { calculateIV, toIV } from '../core/iv/calc';
import { collection, ex, pichuLine, species } from '../core/test-helpers';
import { ExemplarForm } from './ExemplarForm';
import { renderWith } from './test-utils';

async function fillDate(user: ReturnType<typeof renderWith>['user'], value: string) {
  const input = screen.getByLabelText('Data');
  await user.clear(input);
  await user.type(input, value);
}

describe('ExemplarForm', () => {
  it('cadastra um exemplar novo', async () => {
    const onDone = vi.fn();
    const r = renderWith(<ExemplarForm onDone={onDone} />);
    const { user } = r;
    await user.selectOptions(screen.getByLabelText('Espécie'), 'Pikachu');
    await user.type(screen.getByLabelText('CP'), '812');
    await user.type(screen.getByLabelText('IV'), '96% 15/14/14');
    await user.selectOptions(screen.getByLabelText('Origem'), 'troca');
    await fillDate(user, '2026-05-01');
    await user.selectOptions(screen.getByLabelText('Sexo'), 'femea');
    await user.selectOptions(screen.getByLabelText('Tamanho'), 'xxl');
    await user.click(screen.getByLabelText('Brilhante'));
    await user.type(screen.getByLabelText('Notas'), 'do evento');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(r.collection.exemplars).toHaveLength(1);
    const e = r.collection.exemplars[0]!;
    expect(e).toMatchObject({
      speciesId: 'pikachu', cp: 812, iv: { atk: 15, def: 14, sta: 14, percent: 96 }, origin: 'troca',
      date: '2026-05-01', sex: 'femea', size: 'xxl', shiny: true, lucky: false, rocket: 'normal', notes: 'do evento',
    });
    expect(onDone).toHaveBeenCalledWith(e.id);
  });

  it('busca de espécie filtra a lista', async () => {
    const { user } = renderWith(<ExemplarForm onDone={() => {}} />);
    await user.type(screen.getByLabelText('Buscar espécie'), 'rai');
    expect(screen.getAllByRole('option', { name: /Raichu|Pichu|Pikachu/ }).map((o) => o.textContent)).toEqual(['Raichu']);
  });

  it('a espécie salva é a que aparece selecionada depois da busca', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />);
    await r.user.type(screen.getByLabelText('Buscar espécie'), 'rai');
    await r.user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(r.collection.exemplars[0]!.speciesId).toBe('raichu');
  });

  it('IV inconsistente avisa com o valor calculado e não salva', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />);
    await r.user.type(screen.getByLabelText('IV'), '90% 15/14/14');
    await r.user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('96%');
    expect(r.collection.exemplars).toEqual([]);
  });

  it('só a porcentagem é aceita e fica como IV sem detalhe', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />);
    await r.user.type(screen.getByLabelText('IV'), '82');
    await r.user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(r.collection.exemplars[0]!.iv).toEqual({ percent: 82, noDetail: true });
  });

  it('edita um exemplar existente mantendo o id', async () => {
    const e = ex({ speciesId: 'raichu', cp: 1000, iv: { atk: 10, def: 10, sta: 10, percent: 67 } });
    const r = renderWith(<ExemplarForm exemplarId={e.id} onDone={() => {}} />, collection({ exemplars: [e] }));
    expect(screen.getByLabelText('IV')).toHaveValue('67% 10/10/10');
    await r.user.clear(screen.getByLabelText('CP'));
    await r.user.type(screen.getByLabelText('CP'), '1100');
    await r.user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(r.collection.exemplars).toEqual([{ ...e, cp: 1100 }]);
  });

  it('espécie sem gênero não pede sexo', async () => {
    const c = collection({ species: [...pichuLine, species({ id: 'magnemite', name: 'Magnemite', dex: 81, gender: 'sem' })] });
    const r = renderWith(<ExemplarForm onDone={() => {}} />, c);
    await r.user.selectOptions(screen.getByLabelText('Espécie'), 'Magnemite');
    expect(screen.queryByLabelText('Sexo')).toBeNull();
    await r.user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(r.collection.exemplars[0]!.sex).toBeNull();
  });

  it('cadastra fundo novo na hora', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />);
    await r.user.selectOptions(screen.getByLabelText('Espécie'), 'Pikachu');
    await r.user.selectOptions(screen.getByLabelText('Fundo'), '__novo');
    await r.user.type(screen.getByLabelText('Nome do fundo novo'), 'Paris');
    await r.user.selectOptions(screen.getByLabelText('Tipo do fundo'), 'localidade');
    await r.user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(r.collection.backgrounds).toEqual([expect.objectContaining({ name: 'Paris', code: 'L1', species: ['pikachu'] })]);
    expect(r.collection.exemplars[0]!.backgroundId).toBe(r.collection.backgrounds[0]!.id);
  });

  it('mostra avisos de inconsistência', async () => {
    const { user } = renderWith(<ExemplarForm onDone={() => {}} />);
    await user.click(screen.getByLabelText('Sortudo'));
    expect(screen.getByText(/sortudo sempre vem de troca/i)).toBeInTheDocument();
  });

  it('calculadora de IV preenche o IV a partir de CP, PS e poeira', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />);
    const { user } = r;
    await user.selectOptions(screen.getByLabelText('Espécie'), 'Pikachu');
    await user.type(screen.getByLabelText('CP'), '536');
    await user.click(screen.getByRole('button', { name: /calcular iv/i }));
    await user.type(screen.getByLabelText('PS'), '75');
    await user.type(screen.getByLabelText('Poeira'), '2500');
    const expected = calculateIV({ base: pichuLine[1]!.base, cp: 536, hp: 75, dust: 2500, poweredUp: false });
    expect(screen.getByText(new RegExp(`${expected.min}% a ${expected.max}%`))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /usar resultado/i }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(r.collection.exemplars[0]!.iv).toEqual(toIV(expected));
  });

  it('refino pela avaliação reduz a faixa', async () => {
    const { user } = renderWith(<ExemplarForm onDone={() => {}} />);
    await user.selectOptions(screen.getByLabelText('Espécie'), 'Pikachu');
    await user.type(screen.getByLabelText('CP'), '500');
    await user.click(screen.getByRole('button', { name: /calcular iv/i }));
    await user.type(screen.getByLabelText('PS'), '72');
    await user.type(screen.getByLabelText('Poeira'), '2500');
    await user.click(screen.getByLabelText('Já fortalecido'));
    const before = screen.getByText(/combinações/).textContent!;
    await user.selectOptions(screen.getByLabelText('Estrelas'), '3');
    await user.selectOptions(screen.getByLabelText('Barras de ataque'), '3');
    expect(screen.getByText(/combinações/).textContent).not.toBe(before);
  });
});
