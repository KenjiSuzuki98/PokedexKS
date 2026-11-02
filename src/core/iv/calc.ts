import type { IV } from '../types';
import { CPM, DUST_BRACKETS } from './cpm';
import { percentOf } from './parse';

export interface BaseStats {
  atk: number;
  def: number;
  sta: number;
}

export interface Combo {
  level: number;
  atk: number;
  def: number;
  sta: number;
  percent: number;
}

export interface IVResult {
  combos: Combo[];
  min: number;
  max: number;
}

export type DustModifier = 'normal' | 'sortudo' | 'sombroso' | 'purificado';
const DUST_FACTOR: Record<DustModifier, number> = { normal: 1, sortudo: 0.5, sombroso: 1.2, purificado: 0.9 };
const MAX_POWER_UP_LEVEL = 50;

export function cpFor(base: BaseStats, iv: { atk: number; def: number; sta: number }, level: number): number {
  const m = CPM[level]!;
  const cp = ((base.atk + iv.atk) * Math.sqrt(base.def + iv.def) * Math.sqrt(base.sta + iv.sta) * m * m) / 10;
  return Math.max(10, Math.floor(cp));
}

export function hpFor(base: BaseStats, sta: number, level: number): number {
  return Math.max(10, Math.floor((base.sta + sta) * CPM[level]!));
}

/** Níveis possíveis para um custo de poeira. Sem fortalecer, o nível é sempre inteiro. */
export function levelsForDust(dust: number, poweredUp: boolean, modifier: DustModifier = 'normal'): number[] {
  const base = Math.round(dust / DUST_FACTOR[modifier]);
  const i = DUST_BRACKETS.indexOf(base);
  if (i < 0) return [];
  const first = 1 + 2 * i;
  return [first, first + 0.5, first + 1, first + 1.5].filter(
    (l) => l <= MAX_POWER_UP_LEVEL && (poweredUp || Number.isInteger(l)),
  );
}

function summarize(combos: Combo[]): IVResult {
  const ps = combos.map((c) => c.percent);
  return { combos, min: ps.length ? Math.min(...ps) : 0, max: ps.length ? Math.max(...ps) : 0 };
}

export function calculateIV(input: {
  base: BaseStats;
  cp: number;
  hp: number;
  dust: number;
  poweredUp: boolean;
  modifier?: DustModifier;
}): IVResult {
  const combos: Combo[] = [];
  for (const level of levelsForDust(input.dust, input.poweredUp, input.modifier)) {
    for (let sta = 0; sta <= 15; sta++) {
      if (hpFor(input.base, sta, level) !== input.hp) continue;
      for (let atk = 0; atk <= 15; atk++) {
        for (let def = 0; def <= 15; def++) {
          if (cpFor(input.base, { atk, def, sta }, level) === input.cp) {
            combos.push({ level, atk, def, sta, percent: percentOf(atk, def, sta) });
          }
        }
      }
    }
  }
  return summarize(combos);
}

/** Estrelas da avaliação a partir da soma dos três valores (0 a 45). */
export function starsFor(sum: number): number {
  if (sum === 45) return 4;
  if (sum >= 37) return 3;
  if (sum >= 30) return 2;
  if (sum >= 23) return 1;
  return 0;
}

/** Barras da avaliação: segmentos cheios (0 a 3), um a cada 5 pontos. */
export const barsFor = (v: number) => Math.floor(v / 5);

export function refineByAppraisal(
  r: IVResult,
  a: { stars?: number; bars?: { atk?: number; def?: number; sta?: number } },
): IVResult {
  return summarize(
    r.combos.filter(
      (c) =>
        (a.stars === undefined || starsFor(c.atk + c.def + c.sta) === a.stars) &&
        (['atk', 'def', 'sta'] as const).every((k) => a.bars?.[k] === undefined || barsFor(c[k]) === a.bars[k]),
    ),
  );
}

/** Converte o resultado em IV do exemplar: exato se só sobra uma combinação, senão estimado pela média. */
export function toIV(r: IVResult): IV | null {
  if (r.combos.length === 0) return null;
  const distinct = new Set(r.combos.map((c) => `${c.atk}/${c.def}/${c.sta}`));
  if (distinct.size === 1) {
    const { atk, def, sta, percent } = r.combos[0]!;
    return { atk, def, sta, percent };
  }
  return { percent: r.combos.reduce((s, c) => s + c.percent, 0) / r.combos.length, estimated: true };
}
