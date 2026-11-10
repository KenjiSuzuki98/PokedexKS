// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { useState } from 'react';
import { collection, pichuLine, species } from '../core/test-helpers';
import { SpeciesPicker } from './SpeciesPicker';
import { renderWith } from './test-utils';

const table = [...pichuLine, species({ id: 'raichu-alola', name: 'Raichu de Alola', dex: 26, form: 'A', evolvesFrom: 'pikachu' })];
const c = collection({ species: table });

function Host({ onChange, initial = '' }: { onChange: (id: string) => void; initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <SpeciesPicker
      label="Pokémon"
      value={v}
      onChange={(id) => {
        setV(id);
        onChange(id);
      }}
    />
  );
}

const input = () => screen.getByRole('combobox', { name: 'Pokémon' });
const optionNames = () => within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);

describe('SpeciesPicker', () => {
  it('ao focar abre a lista inteira (rolável) em ordem de Nº Pokédex', async () => {
    const { user } = renderWith(<Host onChange={() => {}} />, c);
    await user.click(input());
    expect(optionNames()).toEqual(['0025 Pikachu', '0026 Raichu', '0026A Raichu de Alola', '0172 Pichu']);
  });

  it('pode ordenar a lista por nome', async () => {
    const { user } = renderWith(<Host onChange={() => {}} />, c);
    await user.click(input());
    await user.click(screen.getByRole('button', { name: 'Ordenar por nome' }));
    expect(optionNames()).toEqual(['0172 Pichu', '0025 Pikachu', '0026 Raichu', '0026A Raichu de Alola']);
  });

  it('filtra por nome, Nº ou código de renomear e escolhe clicando', async () => {
    const onChange = vi.fn();
    const { user } = renderWith(<Host onChange={onChange} />, c);
    await user.type(input(), 'rai');
    expect(optionNames()).toEqual(['0026 Raichu', '0026A Raichu de Alola']);
    await user.clear(input());
    await user.type(input(), '0026A');
    expect(optionNames()).toEqual(['0026A Raichu de Alola']);
    await user.click(screen.getByRole('option', { name: /Raichu de Alola/ }));
    expect(onChange).toHaveBeenLastCalledWith('raichu-alola');
    expect(input()).toHaveValue('Raichu de Alola');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('nome exato ou Nº digitado já escolhe a espécie', async () => {
    const onChange = vi.fn();
    const { user } = renderWith(<Host onChange={onChange} />, c);
    await user.type(input(), 'pichu');
    expect(onChange).toHaveBeenLastCalledWith('pichu');
    await user.clear(input());
    await user.type(input(), '26');
    expect(onChange).toHaveBeenLastCalledWith('raichu');
    await user.clear(input());
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('setas e Enter escolhem pelo teclado', async () => {
    const onChange = vi.fn();
    const { user } = renderWith(<Host onChange={onChange} />, c);
    await user.type(input(), 'rai');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('raichu-alola');
  });

  it('quando quem usa limpa a escolha, o campo também limpa', async () => {
    function Reset() {
      const [v, setV] = useState('');
      return (
        <>
          <SpeciesPicker label="Pokémon" value={v} onChange={setV} />
          <button type="button" onClick={() => setV('')}>limpar</button>
        </>
      );
    }
    const { user } = renderWith(<Reset />, c);
    await user.type(input(), 'Pikachu');
    await user.click(screen.getByRole('button', { name: 'limpar' }));
    expect(input()).toHaveValue('');
  });

  it('mostra o nome da espécie já escolhida', () => {
    renderWith(<Host onChange={() => {}} initial="pikachu" />, c);
    expect(input()).toHaveValue('Pikachu');
  });
});
