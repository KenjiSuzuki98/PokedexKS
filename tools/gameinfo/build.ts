import { costumeCode, makeCode, slugify } from '../../src/core/events';
import type { Costume, GenderRule, Species } from '../../src/core/types';
import type { PageData } from './parse';

export interface SpeciesSource {
  base: PageData;
  forms: { label: string; page: PageData }[];
}

const REGIONS: Record<string, string> = { Alola: 'A', Galar: 'G', Hisui: 'H', Paldea: 'P' };

/** gender_rate do PokeAPI: -1 sem gênero, 0 só macho, 8 só fêmea, resto ambos. */
export function genderFromRate(rate: number): GenderRule {
  if (rate === -1) return 'sem';
  if (rate === 0) return 'macho';
  if (rate === 8) return 'femea';
  return 'ambos';
}

/** Une fantasias ligadas por evolução para que compartilhem o mesmo id. */
class UnionFind {
  private parent = new Map<string, string>();
  find(k: string): string {
    if (!this.parent.has(k)) this.parent.set(k, k);
    const p = this.parent.get(k)!;
    if (p === k) return k;
    const root = this.find(p);
    this.parent.set(k, root);
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

interface Draft {
  species: Species;
  page: PageData;
  evolvesFromName: string | null;
  /** Rótulo da forma no site (só para formas). */
  formLabel?: string;
}

export function buildSpeciesTable(
  sources: SpeciesSource[],
  genders: Map<number, number>,
  previous: Pick<Species, 'id' | 'dex' | 'form'>[],
): { species: Species[]; warnings: string[] } {
  const warnings: string[] = [];
  const previousId = new Map(previous.map((p) => [`${p.dex}:${p.form ?? ''}`, p.id]));
  const drafts: Draft[] = [];
  const idByPath = new Map<string, string>();
  // Outros nomes pelos quais o site cita a espécie como pré-evolução, ex.: "Burmy (Manto de areia)".
  const aliases = new Map<string, string>();

  const make = (page: PageData, id: string, name: string, form?: string): Draft => {
    const rate = genders.get(page.dex);
    if (rate === undefined) warnings.push(`Sem dado de sexo para ${name} (#${page.dex}); ficou "ambos".`);
    return {
      page,
      evolvesFromName: page.evolvesFrom,
      species: {
        id: previousId.get(`${page.dex}:${form ?? ''}`) ?? id,
        name,
        dex: page.dex,
        ...(form ? { form } : {}),
        gender: genderFromRate(rate ?? 4),
        shiny: page.shiny,
        mega: page.mega,
        dynamax: page.dynamax,
        gigamax: page.gigamax,
        costumes: [],
        base: page.base ?? { atk: 0, def: 0, sta: 0 },
      },
    };
  };

  for (const { base, forms } of sources) {
    if (!base.inGame) continue;
    const d = make(base, base.slug, base.name);
    drafts.push(d);
    idByPath.set(base.path, d.species.id);
    if (base.defaultForm) aliases.set(slugify(`${base.name} (${base.defaultForm})`), d.species.id);

    const costumeNames = new Set(base.costumes.map((c) => slugify(c.name)));
    const takenForms = new Set<string>();
    for (const { label, page } of forms) {
      // A forma padrão já é a espécie base; Macho/Fêmea já viram vagas de sexo.
      if (!page.inGame || costumeNames.has(slugify(label)) || label === base.defaultForm || /^(Macho|Fêmea)$/.test(label)) continue;
      const short = label.replace(/^(Forma|Padrão|Manto|Estilo|Tamanho) (de |do |da )?/i, '').trim();
      const region = label.match(/^Forma de (Alola|Galar|Hisui|Paldea)$/)?.[1];
      const form = region ? REGIONS[region]! : makeCode(short, [...takenForms, ...Object.values(REGIONS)], 2);
      takenForms.add(form);
      const name = region ? `${base.name} de ${region}` : `${base.name} (${label})`;
      const formDraft = make(page, `${d.species.id}-${slugify(short)}`, name, form);
      formDraft.formLabel = label;
      drafts.push(formDraft);
      aliases.set(slugify(`${base.name} (${label})`), formDraft.species.id);
    }
  }

  // Pré-evolução: o site dá o nome ("Pikachu", "Ponyta de Galar").
  const idByName = new Map([...aliases, ...drafts.map((d) => [slugify(d.species.name), d.species.id] as const)]);
  for (const d of drafts) {
    if (!d.evolvesFromName) continue;
    const plain = d.evolvesFromName.replace(/ \(.+\)$/, '');
    // Uma forma evolui da forma de mesmo nome da pré-evolução, quando ela existe (ex.: Ponyta de Galar).
    const candidate = d.formLabel ? idByName.get(slugify(`${plain} (${d.formLabel})`)) : undefined;
    const sameForm = candidate === d.species.id ? undefined : candidate;
    const id = sameForm ?? idByName.get(slugify(d.evolvesFromName)) ?? idByName.get(slugify(plain));
    if (id) d.species.evolvesFrom = id;
    else warnings.push(`${d.species.name}: pré-evolução "${d.evolvesFromName}" não encontrada.`);
  }

  // Fantasias: as ligadas por evolução compartilham o id.
  const uf = new UnionFind();
  const baseDrafts = drafts.filter((d) => idByPath.get(d.page.path) === d.species.id);
  for (const d of baseDrafts) {
    for (const c of d.page.costumes) {
      const key = `${d.page.path}#${c.slug}`;
      uf.find(key);
      for (const t of c.evolvesTo) uf.union(key, `${t.path}#${t.slug}`);
    }
  }
  for (const d of baseDrafts) {
    const codes: string[] = [];
    d.species.costumes = d.page.costumes.map((c): Costume => {
      const root = uf.find(`${d.page.path}#${c.slug}`);
      const [rootPath, rootSlug] = root.split('#') as [string, string];
      const code = costumeCode(c.name, codes);
      codes.push(code);
      return { id: `${idByPath.get(rootPath) ?? rootPath}-${rootSlug}`, code, name: c.name, shiny: c.shiny };
    });
  }

  return { species: drafts.map((d) => d.species), warnings };
}
