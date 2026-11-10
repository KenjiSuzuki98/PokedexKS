import { slotPrefix } from './slots';
import type { Collection, Slot, Species } from './types';

export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export interface PokemonSearch {
  /** A espécie bate com o texto digitado (nome, Nº Pokédex ou código de renomear)? */
  species(sp: Species, text: string): boolean;
  /** Algum dos códigos (apelidos) bate com o texto? */
  code(codes: (string | null | undefined)[], text: string): boolean;
}

/**
 * Busca usada em todo campo de Pokémon. Aceita:
 * - nome (em qualquer parte, sem acento): "rai";
 * - Nº Pokédex, com ou sem zeros e "#": "25", "0025", "#025";
 * - código de renomear, inteiro ou só o começo: "0025BR", "0026A".
 */
export function makePokemonSearch(c: Collection, slots: Slot[]): PokemonSearch {
  const slotIds = new Map<string, string[]>();
  for (const s of slots) {
    const list = slotIds.get(s.speciesId);
    if (list) list.push(s.id);
    else slotIds.set(s.speciesId, [s.id]);
  }
  const names = new Map(c.species.map((s) => [s.id, normalizeText(s.name)]));

  return {
    species(sp, raw) {
      const text = normalizeText(raw);
      if (!text) return true;
      const digits = text.replace(/^#/, '');
      if (/^\d{1,4}$/.test(digits)) return sp.dex === Number(digits);
      if (/^\d{4}[a-z0-9]+$/.test(text)) {
        const code = text.toUpperCase();
        const prefix = slotPrefix(sp);
        if (code === prefix) return true;
        if (!code.startsWith(prefix)) return false;
        return (slotIds.get(sp.id) ?? []).some((id) => id.startsWith(code));
      }
      return (names.get(sp.id) ?? normalizeText(sp.name)).includes(text);
    },
    code(codes, raw) {
      const text = normalizeText(raw).toUpperCase();
      // Só número é Nº Pokédex, não pedaço de código.
      if (/^#?\d{1,4}$/.test(text)) return false;
      return !!text && codes.some((x) => !!x && x.toUpperCase().includes(text));
    },
  };
}

export type SpeciesOrder = 'dex' | 'nome';

export function sortSpecies(list: Species[], order: SpeciesOrder): Species[] {
  return [...list].sort((a, b) =>
    order === 'dex'
      ? a.dex - b.dex || (a.form ?? '').localeCompare(b.form ?? '') || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name, 'pt-BR') || a.dex - b.dex,
  );
}
