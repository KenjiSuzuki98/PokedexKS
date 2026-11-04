import { parseIV, percentOf } from './parse';

describe('parseIV', () => {
  it('"96% 15/14/14" e "15/14/14 96%" dão o mesmo resultado', () => {
    const a = parseIV('96% 15/14/14');
    expect(a).toEqual({ ok: true, iv: { atk: 15, def: 14, sta: 14, percent: 96 } });
    expect(parseIV('15/14/14 96%')).toEqual(a);
  });

  it('"96% 15/14/15" (exemplo do CLAUDE.md) dá o mesmo aviso nas duas ordens: 44/45 = 98%', () => {
    const a = parseIV('96% 15/14/15');
    expect(a).toEqual({ ok: false, error: expect.stringContaining('98'), computed: 98 });
    expect(parseIV('15/14/15 96%')).toEqual(a);
  });

  it('aceita separadores variados', () => {
    const expected = { ok: true, iv: { atk: 15, def: 14, sta: 14, percent: 96 } };
    for (const s of ['96 (15-14-14)', '(96%) 15 14 14', '15-14-14 (96)', '96%-15/14/14', '  96 %  15 / 14 / 14 ']) {
      expect(parseIV(s), s).toEqual(expected);
    }
  });

  it('porcentagem inconsistente gera aviso com o valor calculado', () => {
    expect(parseIV('90% 15/14/14')).toEqual({ ok: false, error: expect.stringContaining('96'), computed: 96 });
  });

  it('só os valores: porcentagem é derivada', () => {
    expect(parseIV('15/14/15')).toEqual({ ok: true, iv: { atk: 15, def: 14, sta: 15, percent: 98 } });
    expect(parseIV('0/0/0')).toEqual({ ok: true, iv: { atk: 0, def: 0, sta: 0, percent: 0 } });
  });

  it('só a porcentagem: fica marcado como IV sem detalhe', () => {
    expect(parseIV('96%')).toEqual({ ok: true, iv: { percent: 96, noDetail: true } });
    expect(parseIV('82')).toEqual({ ok: true, iv: { percent: 82, noDetail: true } });
  });

  it('rejeita entradas inválidas', () => {
    for (const s of ['', 'abc', '16/14/15', '101%', '15/14', '96% 15/14/15 3', '10 10 10 10']) {
      expect(parseIV(s).ok, s).toBe(false);
    }
  });
});

describe('percentOf segue a planilha de IVs (IV % jogo = ARRED(soma/45; 2))', () => {
  it('bate nas 4.096 combinações', () => {
    for (let a = 0; a <= 15; a++)
      for (let d = 0; d <= 15; d++)
        for (let s = 0; s <= 15; s++) {
          const excel = Math.round(((a + d + s) / 45) * 100 + Number.EPSILON);
          expect(percentOf(a, d, s)).toBe(excel);
        }
    expect([percentOf(15, 15, 15), percentOf(15, 15, 14), percentOf(15, 15, 13), percentOf(15, 15, 12), percentOf(15, 15, 10)]).toEqual([100, 98, 96, 93, 89]);
  });
});
