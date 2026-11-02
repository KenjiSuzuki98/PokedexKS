import type { IV } from '../types';

export type ParseResult = { ok: true; iv: IV } | { ok: false; error: string; computed?: number };

const fail = (error: string, computed?: number): ParseResult => ({ ok: false, error, ...(computed !== undefined ? { computed } : {}) });

export const percentOf = (atk: number, def: number, sta: number) => Math.round(((atk + def + sta) / 45) * 100);

/**
 * Lê a entrada direta de IV: porcentagem e/ou ataque/defesa/PS, em qualquer ordem
 * e com separadores livres (espaço, barra, hífen, parênteses).
 */
export function parseIV(text: string): ParseResult {
  if (/[^\d\s%/().,\-]/.test(text)) return fail('Use só números, % e separadores.');
  const tokens = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(%?)/g)].map((m) => ({
    value: Number(m[1]!.replace(',', '.')),
    pct: m[2] === '%',
  }));
  if (tokens.length === 0) return fail('Informe a porcentagem e/ou os três valores.');

  const marked = tokens.filter((t) => t.pct);
  if (marked.length > 1) return fail('Mais de uma porcentagem.');
  let percent: number | undefined = marked[0]?.value;
  let stats = tokens.filter((t) => !t.pct).map((t) => t.value);

  if (percent === undefined) {
    if (stats.length === 1) {
      percent = stats[0];
      stats = [];
    } else if (stats.length === 4) {
      // Sem %, a porcentagem é o número das pontas que não cabe num atributo (> 15).
      const first = stats[0]!;
      const last = stats[3]!;
      if (first > 15 && last <= 15) {
        percent = first;
        stats = stats.slice(1);
      } else if (last > 15 && first <= 15) {
        percent = last;
        stats = stats.slice(0, 3);
      } else {
        return fail('Não sei qual número é a porcentagem; use o símbolo %.');
      }
    }
  }

  if (stats.length !== 0 && stats.length !== 3) return fail('Informe os três valores (ataque/defesa/PS).');
  if (percent !== undefined && !(percent >= 0 && percent <= 100)) return fail('Porcentagem deve ficar entre 0 e 100.');

  if (stats.length === 0) return { ok: true, iv: { percent: percent!, noDetail: true } };

  const [atk, def, sta] = stats as [number, number, number];
  if (!stats.every((v) => Number.isInteger(v) && v >= 0 && v <= 15)) return fail('Cada valor deve ser inteiro de 0 a 15.');
  const computed = percentOf(atk, def, sta);
  if (percent !== undefined && percent !== computed) {
    return fail(`A porcentagem não bate com os valores: ${atk}/${def}/${sta} dá ${computed}%.`, computed);
  }
  return { ok: true, iv: { atk, def, sta, percent: computed } };
}
