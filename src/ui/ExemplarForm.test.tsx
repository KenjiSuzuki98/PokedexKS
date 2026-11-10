// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { calculateIV, cpFor, hpFor, levelsForDust } from '../core/iv/calc';
import { collection, ex, pichuLine, species } from '../core/test-helpers';
import { ExemplarForm } from './ExemplarForm';
import { renderWith } from './test-utils';

const table = [
  ...pichuLine,
  species({ id: 'raichu-alola', name: 'Raichu de Alola', dex: 26, form: 'A', evolvesFrom: 'pikachu', shiny: true }),
  species({ id: 'magnemite', name: 'Magnemite', dex: 81, gender: 'sem' }),
  species({ id: 'chansey', name: 'Chansey', dex: 113, gender: 'femea' }),
];
const base = (over = {}) => collection({ species: table, ...over });
const auto = (name: string) => screen.getByRole('status', { name });

async function pick(user: ReturnType<typeof renderWith>['user'], text: string) {
  const input = screen.getByRole('combobox', { name: 'Pokémon' });
  await user.clear(input);
  await user.type(input, text);
}
async function stats(user: ReturnType<typeof renderWith>['user'], atk: string, def: string, sta: string) {
  for (const [label, v] of [['ATK', atk], ['DEF', def], ['PS', sta]] as const) {
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), v);
  }
}
const save = (user: ReturnType<typeof renderWith>['user']) => user.click(screen.getByRole('button', { name: 'Salvar' }));

describe('ExemplarForm', () => {
  it('nome ou Nº preenchem sozinhos Nº Pokédex e Região', async () => {
    const { user } = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(user, 'pikachu');
    expect(auto('Nº Pokédex')).toHaveTextContent('0025');
    expect(auto('Região')).toHaveTextContent('Kanto');
    await pick(user, '172');
    expect(auto('Nº Pokédex')).toHaveTextContent('0172');
    expect(auto('Região')).toHaveTextContent('Johto');
  });

  it('sem PC e sem data de captura', () => {
    renderWith(<ExemplarForm onDone={() => {}} />, base());
    expect(screen.queryByLabelText(/^(CP|PC)$/)).toBeNull();
    expect(screen.queryByLabelText('Data')).toBeNull();
  });

  it('ATK/DEF/PS calculam o IV % como no jogo e são salvos', async () => {
    const onDone = vi.fn();
    const r = renderWith(<ExemplarForm onDone={onDone} />, base());
    await pick(r.user, 'Raichu');
    await stats(r.user, '15', '14', '14');
    expect(auto('IV %')).toHaveTextContent('96');
    await save(r.user);
    const e = r.collection.exemplars[0]!;
    expect(e).toMatchObject({ speciesId: 'raichu', iv: { atk: 15, def: 14, sta: 14, percent: 96 }, origin: 'capturado' });
    expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onDone).toHaveBeenCalledWith(e.id);
  });

  it('valor fora de 0–15 avisa e não salva', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, 'Raichu');
    await stats(r.user, '16', '1', '1');
    await save(r.user);
    expect(screen.getByRole('alert')).toHaveTextContent(/0 a 15/);
    expect(r.collection.exemplars).toEqual([]);
  });

  it('botões de sexo, tamanho e Rocket; marcadores de brilhante, Dinamax e Gigamax', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, 'Raichu');
    await r.user.click(within(screen.getByRole('group', { name: 'Sexo' })).getByRole('button', { name: 'Fêmea' }));
    await r.user.click(within(screen.getByRole('group', { name: 'Tamanho' })).getByRole('button', { name: 'XXL' }));
    await r.user.click(within(screen.getByRole('group', { name: 'Rocket' })).getByRole('button', { name: 'Sombroso' }));
    await r.user.click(screen.getByLabelText('Brilhante'));
    await r.user.click(screen.getByLabelText('Gigamax'));
    expect(within(screen.getByRole('group', { name: 'Tamanho' })).getByRole('button', { name: 'XXL' })).toHaveAttribute('aria-pressed', 'true');
    await save(r.user);
    expect(r.collection.exemplars[0]).toMatchObject({ sex: 'femea', size: 'xxl', rocket: 'sombroso', shiny: true, gigamax: true });
  });

  it('sortudo marca sozinho "recebido em troca"', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, 'Raichu');
    await r.user.click(screen.getByLabelText('Sortudo'));
    expect(screen.getByLabelText('Recebido em troca')).toBeChecked();
    expect(screen.getByLabelText('Recebido em troca')).toBeDisabled();
    await save(r.user);
    expect(r.collection.exemplars[0]).toMatchObject({ lucky: true, origin: 'troca' });
  });

  it('ID preenchido sozinho: a vaga que ele vai ocupar, ou "fora da Pokédex"', async () => {
    const best = ex({ speciesId: 'raichu', iv: { atk: 15, def: 15, sta: 15, percent: 100 } });
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, 'Raichu');
    expect(auto('ID')).toHaveTextContent('0026EV');
    r.unmount();
    const r2 = renderWith(<ExemplarForm onDone={() => {}} />, base({ exemplars: [best] }));
    await pick(r2.user, 'Raichu');
    await stats(r2.user, '1', '1', '1');
    expect(auto('ID')).toHaveTextContent(/fora da pokédex.*troca/i);
    await r2.user.click(screen.getByLabelText('Brilhante'));
    expect(auto('ID')).toHaveTextContent('0026BR');
  });

  it('espécie sem gênero ou de um sexo só', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, 'Magnemite');
    expect(within(screen.getByRole('group', { name: 'Sexo' })).getByRole('button', { name: 'Macho' })).toBeDisabled();
    await save(r.user);
    await pick(r.user, 'Chansey');
    await save(r.user);
    expect(r.collection.exemplars.map((e) => e.sex)).toEqual([null, 'femea']);
  });

  it('variação lista as formas do mesmo Nº', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, 'Raichu');
    const variation = screen.getByLabelText('Variação');
    expect(within(variation).getAllByRole('option').map((o) => o.textContent)).toEqual(['Raichu', 'Raichu de Alola', 'nova variação…']);
    await r.user.selectOptions(variation, 'raichu-alola');
    expect(auto('Nº Pokédex')).toHaveTextContent('0026A');
    await save(r.user);
    expect(r.collection.exemplars[0]!.speciesId).toBe('raichu-alola');
  });

  it('cadastra variação nova na hora', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, 'Pikachu');
    await r.user.selectOptions(screen.getByLabelText('Variação'), '__novo');
    await r.user.type(screen.getByLabelText('Nome da nova variação'), 'Libre');
    await save(r.user);
    const created = r.collection.species.find((s) => s.name === 'Pikachu (Libre)')!;
    expect(created).toMatchObject({ dex: 25, evolvesFrom: 'pichu' });
    expect(created.form).toBeTruthy();
    expect(r.collection.exemplars[0]!.speciesId).toBe(created.id);
  });

  it('traje: só escolhe entre os trajes cadastrados nos eventos, sem criar traje no cadastro', async () => {
    const boina = { id: 'boina', code: 'BOIN', name: 'Boina', shiny: false, since: { eventId: 'ev1' } };
    const withCostume = table.map((s) => (s.id === 'pikachu' ? { ...s, costumes: [boina] } : s));
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base({ species: withCostume }));
    await pick(r.user, 'Pikachu');
    const traje = screen.getByLabelText('Traje');
    expect(within(traje).getAllByRole('option').map((o) => o.textContent)).toEqual(['sem traje', 'Boina']);
    expect(screen.getByText(/traje novo.*linha do tempo/i)).toBeInTheDocument();
    await r.user.selectOptions(traje, 'boina');
    await save(r.user);
    expect(r.collection.exemplars[0]!.costumeId).toBe('boina');
  });

  describe('ler print', () => {
    // Números coerentes com Pikachu sombroso 15/14/15 no menor nível da faixa de 2500 (sombroso paga 3000).
    const pikachu = table.find((s) => s.id === 'pikachu')!;
    const level = levelsForDust(2500, false)[0]!;
    const cp = cpFor(pikachu.base, { atk: 15, def: 14, sta: 15 }, level);
    const hp = hpFor(pikachu.base, 15, level);
    const screenText = `PC ${cp}\nPikachu ♀\n${hp} / ${hp} PS\nXXL\n3000 2 DOCE DE PIKACHU\nFORTALECER 3000\nFrustração`;
    const upload = (user: ReturnType<typeof renderWith>['user']) =>
      user.upload(screen.getByLabelText('Ler print'), new File(['x'], 'print.png', { type: 'image/png' }));

    it('preenche espécie, sexo, tamanho, Rocket e calcula o IV a partir de PC, PS e poeira', async () => {
      const recognize = vi.fn().mockResolvedValue(screenText);
      const r = renderWith(<ExemplarForm onDone={() => {}} recognize={recognize} />, base());
      await upload(r.user);
      expect(await screen.findByRole('combobox', { name: 'Pokémon' })).toHaveValue('Pikachu');
      expect(within(screen.getByRole('group', { name: 'Sexo' })).getByRole('button', { name: 'Fêmea' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(screen.getByRole('group', { name: 'Tamanho' })).getByRole('button', { name: 'XXL' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(screen.getByRole('group', { name: 'Rocket' })).getByRole('button', { name: 'Sombroso' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('PC')).toHaveValue(cp);
      expect(screen.getByLabelText('PS máximo')).toHaveValue(hp);
      expect(screen.getByLabelText('Poeira')).toHaveValue(3000);

      const result = calculateIV({ base: pikachu.base, cp, hp, dust: 3000, poweredUp: false, modifier: 'sombroso' });
      const distinct = new Set(result.combos.map((x) => `${x.atk}/${x.def}/${x.sta}`));
      if (distinct.size > 1) await r.user.click(screen.getByRole('button', { name: /^15\/14\/15/ }));
      expect(screen.getByLabelText('ATK')).toHaveValue(15);
      expect(screen.getByLabelText('DEF')).toHaveValue(14);
      expect(screen.getByLabelText('PS')).toHaveValue(15);
      expect(screen.getByText(/confira brilhante, traje e fundo/i)).toBeInTheDocument();
    });

    it('falha na leitura avisa sem mudar nada', async () => {
      const recognize = vi.fn().mockRejectedValue(new Error('sem rede'));
      const r = renderWith(<ExemplarForm onDone={() => {}} recognize={recognize} />, base());
      await upload(r.user);
      expect(await screen.findByRole('alert')).toHaveTextContent(/não consegui ler o print/i);
      expect(screen.getByRole('combobox', { name: 'Pokémon' })).toHaveValue('');
    });
  });

  it('escolhe o Pokémon pelo código de renomear', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, '0026A');
    expect(auto('Nº Pokédex')).toHaveTextContent('0026A');
    await save(r.user);
    expect(r.collection.exemplars[0]!.speciesId).toBe('raichu-alola');
  });

  it('cadastra fundo novo na hora', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, 'Pikachu');
    await r.user.selectOptions(screen.getByLabelText('Fundo'), '__novo');
    await r.user.type(screen.getByLabelText('Nome do fundo novo'), 'Paris');
    await r.user.selectOptions(screen.getByLabelText('Tipo do fundo'), 'localidade');
    await save(r.user);
    expect(r.collection.backgrounds).toEqual([expect.objectContaining({ name: 'Paris', code: 'L1', species: ['pikachu'] })]);
    expect(r.collection.exemplars[0]!.backgroundId).toBe(r.collection.backgrounds[0]!.id);
  });

  it('Pokémon desconhecido avisa e não salva', async () => {
    const r = renderWith(<ExemplarForm onDone={() => {}} />, base());
    await pick(r.user, 'Agumon');
    await save(r.user);
    expect(screen.getByRole('alert')).toHaveTextContent(/escolha o pokémon/i);
    expect(r.collection.exemplars).toEqual([]);
  });

  it('edita um exemplar existente mantendo id, data e PC antigos', async () => {
    const e = ex({ speciesId: 'raichu', cp: 1000, date: '2025-01-01', iv: { atk: 10, def: 10, sta: 10, percent: 67 } });
    const r = renderWith(<ExemplarForm exemplarId={e.id} onDone={() => {}} />, base({ exemplars: [e] }));
    expect(screen.getByRole('combobox', { name: 'Pokémon' })).toHaveValue('Raichu');
    expect(screen.getByLabelText('ATK')).toHaveValue(10);
    await stats(r.user, '15', '10', '10');
    await save(r.user);
    expect(r.collection.exemplars).toEqual([{ ...e, iv: { atk: 15, def: 10, sta: 10, percent: 78 } }]);
  });
});
