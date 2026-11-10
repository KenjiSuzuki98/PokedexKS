import { generateSlots } from './slots';
import { parseScreenshotText } from './screenshot';
import { collection, pichuLine } from './test-helpers';

const c = collection();
const read = (text: string) => parseScreenshotText(c, generateSlots(c), text);

// Texto como o OCR costuma devolver da tela do Pokémon (com ruído).
const pikachuScreen = `
  PC 812
  Pikachu
  ♀
  64 / 64 PS
  6.01kg  0.41m XXL
  Peso Altura
  Tipo Eletrico
  2500 Poeira Estelar  2 DOCE DE PIKACHU
  FORTALECER  2500 2
  Choque do Trovão  Frustração
`;

describe('parseScreenshotText (texto do print → dados do cadastro)', () => {
  it('lê espécie, PC, PS, poeira, sexo e tamanho', () => {
    expect(read(pikachuScreen)).toMatchObject({
      speciesId: 'pikachu', cp: 812, hp: 64, dust: 2500, sex: 'femea', size: 'xxl',
    });
  });

  it('Frustração indica sombroso; Retorno indica purificado', () => {
    expect(read(pikachuScreen).rocket).toBe('sombroso');
    expect(read('PC 500 Raichu 50/50 PS Retorno').rocket).toBe('purificado');
    expect(read('PC 500 Raichu 50/50 PS').rocket).toBeUndefined();
  });

  it('sortudo e troca', () => {
    expect(read('POKÉMON SORTUDO PC 500 Raichu').lucky).toBe(true);
    expect(read('PC 500 Raichu Data da troca 01/02/2025').traded).toBe(true);
    const plain = read('PC 500 Raichu');
    expect(plain.lucky).toBeUndefined();
    expect(plain.traded).toBeUndefined();
  });

  it('apelido com código de renomear identifica a espécie mesmo sem o nome', () => {
    expect(read('PC 1500 0026BR 80/80 PS').speciesId).toBe('raichu');
  });

  it('o nome do doce indica a cadeia quando o nome não aparece', () => {
    const r = read('PC 300 Fulano 40/40 PS 3 DOCE DE PICHU');
    expect(r.speciesId).toBeUndefined();
    expect(r.candyOf).toBe('pichu');
  });

  it('aceita PS e PC com ruído do OCR (CP, HP, sem espaço, macho)', () => {
    expect(read('CP1234 Raichu 101/101HP ♂')).toMatchObject({ cp: 1234, hp: 101, sex: 'macho', speciesId: 'raichu' });
  });

  it('prefere o nome mais longo (Raichu de Alola em vez de Raichu)', () => {
    const sp = [...pichuLine, { ...pichuLine[2]!, id: 'raichu-alola', name: 'Raichu de Alola', form: 'A' }];
    const col = collection({ species: sp });
    expect(parseScreenshotText(col, generateSlots(col), 'PC 900 Raichu de Alola 70/70 PS').speciesId).toBe('raichu-alola');
  });
});
