import { importPokeGenieCSV, parseCSV } from './csv';
import { collection, species } from './test-helpers';

describe('parseCSV', () => {
  it('lida com aspas, vírgula dentro de aspas, CRLF e BOM', () => {
    expect(parseCSV('﻿a,b,c\r\n1,"x, y","diz ""oi"""\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x, y', 'diz "oi"'],
    ]);
  });
  it('detecta ponto e vírgula como separador', () => {
    expect(parseCSV('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

const table = collection({
  species: [
    ...collection().species,
    species({ id: 'magnemite', name: 'Magnemite', dex: 81, gender: 'sem' }),
    species({ id: 'raichu-alola', name: 'Raichu', dex: 26, form: 'A', evolvesFrom: 'pikachu' }),
  ],
});

const header = 'Index,Name,Form,Pokemon Number,Gender,CP,HP,Atk IV,Def IV,Sta IV,IV Avg,Level Min,Level Max,Catch Date,Lucky,Shadow/Purified,Favorite';
let n = 0;
const id = () => `imp${++n}`;

describe('importPokeGenieCSV', () => {
  beforeEach(() => (n = 0));

  it('importa espécie, CP, IV, sexo, sortudo e Rocket, e marca o que falta como pendente', () => {
    const csv = [header, '1,Pikachu,,25,♀,812,82,15,14,14,95.6,20,20,,0,1,0'].join('\n');
    const { exemplars, errors } = importPokeGenieCSV(csv, table, { newId: id, today: '2026-11-02' });
    expect(errors).toEqual([]);
    expect(exemplars).toEqual([
      expect.objectContaining({
        id: 'imp1', speciesId: 'pikachu', cp: 812, iv: { atk: 15, def: 14, sta: 14, percent: 96 },
        sex: 'femea', lucky: false, rocket: 'sombroso', origin: 'capturado', date: '2026-11-02', shiny: false, size: 'normal',
      }),
    ]);
    expect(exemplars[0]!.pendingFields!.sort()).toEqual(['background', 'costume', 'date', 'origin', 'shiny', 'size']);
  });

  it('sortudo vem de troca (origem não fica pendente) e data de captura é usada quando existe', () => {
    const csv = [header, '1,Raichu,,26,♂,2000,120,10,10,10,66.7,30,30,15/03/2024,1,2,0'].join('\n');
    const [e] = importPokeGenieCSV(csv, table, { newId: id, today: '2026-11-02' }).exemplars;
    expect(e).toMatchObject({ origin: 'troca', lucky: true, rocket: 'purificado', date: '2024-03-15', sex: 'macho' });
    expect(e!.pendingFields).not.toContain('origin');
    expect(e!.pendingFields).not.toContain('date');
  });

  it('formato de data mês/dia quando pedido, e AAAA-MM-DD sempre', () => {
    const rows = [header, '1,Raichu,,26,♂,2000,120,10,10,10,,30,30,03/15/2024,0,0,0', '2,Raichu,,26,♂,2000,120,10,10,10,,30,30,2024-03-16,0,0,0'];
    const ex = importPokeGenieCSV(rows.join('\n'), table, { newId: id, today: '2026-11-02', dateFormat: 'mdy' }).exemplars;
    expect(ex.map((e) => e.date)).toEqual(['2024-03-15', '2024-03-16']);
  });

  it('espécie sem gênero não deixa sexo pendente; forma regional é reconhecida', () => {
    const csv = [header, '1,Magnemite,,81,,500,50,1,2,3,,15,15,,0,0,0', '2,Raichu,Alola,26,♀,1500,100,5,5,5,,25,25,,0,0,0'].join('\n');
    const ex = importPokeGenieCSV(csv, table, { newId: id, today: '2026-11-02' }).exemplars;
    expect(ex[0]).toMatchObject({ speciesId: 'magnemite', sex: null });
    expect(ex[0]!.pendingFields).not.toContain('sex');
    expect(ex[1]!.speciesId).toBe('raichu-alola');
  });

  it('sem sexo informado numa espécie com dois sexos, sexo fica pendente', () => {
    const csv = [header, '1,Pikachu,,25,,500,50,1,2,3,,15,15,,0,0,0'].join('\n');
    expect(importPokeGenieCSV(csv, table, { newId: id, today: '2026-11-02' }).exemplars[0]!.pendingFields).toContain('sex');
  });

  it('linhas com espécie desconhecida ou IV inválido viram erro com o número da linha', () => {
    const csv = [header, '1,Mewtwo,,150,,4000,150,15,15,15,,40,40,,0,0,0', '2,Pikachu,,25,♂,500,50,16,2,3,,15,15,,0,0,0'].join('\n');
    const { exemplars, errors } = importPokeGenieCSV(csv, table, { newId: id, today: '2026-11-02' });
    expect(exemplars).toEqual([]);
    expect(errors).toEqual([
      { line: 2, message: expect.stringMatching(/Mewtwo/) },
      { line: 3, message: expect.stringMatching(/IV/) },
    ]);
  });

  it('recusa arquivo sem as colunas mínimas', () => {
    expect(() => importPokeGenieCSV('a,b\n1,2', table, { newId: id, today: '2026-11-02' })).toThrow(/coluna/i);
  });
});
