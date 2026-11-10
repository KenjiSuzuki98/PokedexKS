import { DUST_BRACKETS } from './iv/cpm';
import { makePokemonSearch, normalizeText } from './search';
import type { Collection, Rocket, Sex, Size, Slot } from './types';

/** O que deu para ler de um print da tela do Pokémon. Campo ausente = não deu para ler. */
export interface ScreenshotGuess {
  speciesId?: string;
  /** Espécie do doce ("DOCE DE PICHU"): indica a cadeia quando o nome não aparece. */
  candyOf?: string;
  cp?: number;
  hp?: number;
  /** Custo de poeira estelar para fortalecer. */
  dust?: number;
  sex?: Sex;
  size?: Size;
  rocket?: Rocket;
  lucky?: boolean;
  traded?: boolean;
}

// Poeira possível: tabela normal e com desconto/acréscimo de sortudo, sombroso e purificado.
const DUST_VALUES = new Set(DUST_BRACKETS.flatMap((d) => [d, d / 2, Math.round(d * 1.2), Math.round(d * 0.9)]));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Interpreta o texto que o OCR leu do print. Não depende do OCR em si: recebe texto puro.
 * Brilhante, traje e fundo não aparecem como texto e ficam para conferir à mão.
 */
export function parseScreenshotText(c: Collection, slots: Slot[], raw: string): ScreenshotGuess {
  const g: ScreenshotGuess = {};
  const text = raw.replace(/\s+/g, ' ');
  const plain = normalizeText(text);

  const cp = text.match(/\b(?:PC|CP)\s*[:.]?\s*(\d{2,5})\b/i);
  if (cp) g.cp = Number(cp[1]);
  const hp = text.match(/(\d{1,4})\s*\/\s*(\d{1,4})\s*(?:PS|HP)/i) ?? text.match(/(?:PS|HP)\s*(\d{1,4})\s*\/\s*(\d{1,4})/i);
  if (hp) g.hp = Number(hp[2]);

  // Poeira: o valor válido que mais aparece (o custo aparece no botão de fortalecer e no resumo).
  const counts = new Map<number, number>();
  for (const m of text.matchAll(/\b(\d{3,5})\b/g)) {
    const n = Number(m[1]);
    if (DUST_VALUES.has(n) && n !== g.cp && n !== g.hp) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const dust = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dust) g.dust = dust[0];

  if (text.includes('♀')) g.sex = 'femea';
  else if (text.includes('♂')) g.sex = 'macho';
  if (/\bXXL\b/i.test(text)) g.size = 'xxl';
  else if (/\bXXS\b/i.test(text)) g.size = 'xxs';
  if (/frustra/i.test(plain)) g.rocket = 'sombroso';
  else if (/\b(retorno|return)\b/i.test(plain)) g.rocket = 'purificado';
  if (/sortud|lucky/i.test(plain)) g.lucky = true;
  if (/\btroca\b|\btrade/i.test(plain)) g.traded = true;

  const byName = (name: string) => c.species.find((s) => normalizeText(s.name) === normalizeText(name));
  const candy = plain.match(/doces? de ([a-z0-9]+)/) ?? plain.match(/([a-z0-9]+) candy/);
  if (candy) {
    const sp = byName(candy[1]!);
    if (sp) g.candyOf = sp.id;
  }

  // Nome da espécie fora da frase do doce; o nome mais longo ganha (Raichu de Alola > Raichu).
  const withoutCandy = plain.replace(/doces? de [a-z0-9]+|[a-z0-9]+ candy/g, ' ');
  const named = c.species
    .filter((s) => new RegExp(`(^|[^a-z0-9])${escape(normalizeText(s.name))}($|[^a-z0-9])`).test(withoutCandy))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (named) g.speciesId = named.id;
  else {
    // Apelido com o código de renomear (ex.: 0026BR).
    const code = text.match(/\b(\d{4}[A-Z][A-Z0-9]{0,8})\b/);
    if (code) {
      const search = makePokemonSearch(c, slots);
      const hits = c.species.filter((s) => search.species(s, code[1]!));
      const hit = hits.find((s) => !s.form) ?? hits[0];
      if (hit) g.speciesId = hit.id;
    }
  }
  return g;
}
