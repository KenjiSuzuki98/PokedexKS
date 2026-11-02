import { validateSpeciesTable } from '../../src/core/chain';
import { buildSpeciesTable, genderFromRate, type SpeciesSource } from './build';
import type { PageData } from './parse';

function pg(dex: number, slug: string, name: string, over: Partial<PageData> = {}): PageData {
  return {
    path: `/pt-br/pokemon/${dex}-${slug}`, slug, dex, name, defaultForm: null, inGame: true, shiny: true,
    base: { atk: 100, def: 100, sta: 100 }, evolvesFrom: null, mega: false, dynamax: false, gigamax: false,
    forms: [], costumes: [], ...over,
  };
}
const src = (base: PageData, forms: SpeciesSource['forms'] = []): SpeciesSource => ({ base, forms });
const genders = new Map([[172, 4], [25, 4], [26, 4], [77, 4], [78, 4], [81, -1], [113, 8], [32, 0], [351, 4]]);
const table = (sources: SpeciesSource[], previous = []) =>
  buildSpeciesTable(sources, genders, previous);
const collectionOf = (species: ReturnType<typeof table>['species']) =>
  ({ species, backgrounds: [], customCategories: [], events: [], exemplars: [] });

describe('genderFromRate', () => {
  it('converte gender_rate do PokeAPI', () => {
    expect([-1, 0, 8, 4, 1].map(genderFromRate)).toEqual(['sem', 'macho', 'femea', 'ambos', 'ambos']);
  });
});

describe('buildSpeciesTable', () => {
  const chain = [
    src(pg(172, 'pichu', 'Pichu')),
    src(pg(25, 'pikachu', 'Pikachu', { evolvesFrom: 'Pichu', dynamax: true, gigamax: true })),
    src(pg(26, 'raichu', 'Raichu', { evolvesFrom: 'Pikachu', mega: true, base: { atk: 193, def: 151, sta: 155 } })),
  ];

  it('monta a cadeia, marcações, atributos e sexo', () => {
    const { species, warnings } = table(chain);
    expect(warnings).toEqual([]);
    expect(species.map((s) => [s.id, s.evolvesFrom])).toEqual([['pichu', undefined], ['pikachu', 'pichu'], ['raichu', 'pikachu']]);
    expect(species[1]).toMatchObject({ dex: 25, name: 'Pikachu', shiny: true, dynamax: true, gigamax: true, mega: false, gender: 'ambos', costumes: [] });
    expect(species[2]).toMatchObject({ mega: true, base: { atk: 193, def: 151, sta: 155 } });
    expect(validateSpeciesTable(collectionOf(species))).toEqual([]);
  });

  it('sexo pelo PokeAPI; sem dado vira aviso e "ambos"', () => {
    const { species, warnings } = table([src(pg(81, 'magnemite', 'Magnemite')), src(pg(113, 'chansey', 'Chansey')), src(pg(999, 'x', 'X'))]);
    expect(species.map((s) => s.gender)).toEqual(['sem', 'femea', 'ambos']);
    expect(warnings).toEqual([expect.stringMatching(/sexo.*X/i)]);
  });

  it('ignora o que ainda não está no jogo e avisa pré-evolução desconhecida', () => {
    const { species, warnings } = table([
      src(pg(1024, 'terapagos', 'Terapagos', { inGame: false })),
      src(pg(26, 'raichu', 'Raichu', { evolvesFrom: 'Pikachu' })),
    ]);
    expect(species.map((s) => s.id)).toEqual(['raichu']);
    expect(species[0]!.evolvesFrom).toBeUndefined();
    expect(warnings).toEqual([expect.stringMatching(/Pikachu/)]);
  });

  it('reaproveita os ids da tabela anterior (mesmo Nº e forma)', () => {
    const previous = [{ id: 'nidoran-m', dex: 32 }] as never;
    const { species } = table([src(pg(32, 'nidoran-male', 'Nidoran♂'))], previous);
    expect(species[0]!.id).toBe('nidoran-m');
  });

  it('formas regionais viram espécies com letra de forma e evolução própria', () => {
    const alola = pg(26, 'raichu', 'Raichu', { path: '/pt-br/pokemon/26-raichu/forma-de-alola', evolvesFrom: 'Pikachu', base: { atk: 201, def: 154, sta: 155 } });
    const galarPonyta = pg(77, 'ponyta', 'Ponyta', { path: '/pt-br/pokemon/77-ponyta/forma-de-galar' });
    const galarRapidash = pg(78, 'rapidash', 'Rapidash', { path: '/pt-br/pokemon/78-rapidash/forma-de-galar', evolvesFrom: 'Ponyta de Galar' });
    const { species, warnings } = table([
      ...chain.slice(0, 2),
      src(chain[2]!.base, [{ label: 'Forma de Alola', page: alola }]),
      src(pg(77, 'ponyta', 'Ponyta'), [{ label: 'Forma de Galar', page: galarPonyta }]),
      src(pg(78, 'rapidash', 'Rapidash', { evolvesFrom: 'Ponyta' }), [{ label: 'Forma de Galar', page: galarRapidash }]),
    ]);
    expect(warnings).toEqual([]);
    expect(species.find((s) => s.id === 'raichu-alola')).toMatchObject({
      name: 'Raichu de Alola', dex: 26, form: 'A', evolvesFrom: 'pikachu', base: { atk: 201, def: 154, sta: 155 },
    });
    expect(species.find((s) => s.id === 'rapidash-galar')).toMatchObject({ form: 'G', evolvesFrom: 'ponyta-galar' });
  });

  it('outras formas ganham código curto; forma igual a fantasia fica só como fantasia', () => {
    const base = pg(25, 'pikachu', 'Pikachu', {
      costumes: [{ slug: 'libre', name: 'Libre', shiny: false, evolvesTo: [] }],
    });
    const libre = pg(25, 'pikachu', 'Pikachu', { path: '/pt-br/pokemon/25-pikachu/libre' });
    const castform = pg(351, 'castform', 'Castform');
    const sunny = pg(351, 'castform', 'Castform', { path: '/pt-br/pokemon/351-castform/forma-ensolarada' });
    const { species } = table([
      src(base, [{ label: 'Libre', page: libre }]),
      src(castform, [{ label: 'Forma Ensolarada', page: sunny }]),
    ]);
    expect(species.map((s) => s.id)).toEqual(['pikachu', 'castform', 'castform-ensolarada']);
    expect(species[2]).toMatchObject({ name: 'Castform (Forma Ensolarada)', form: 'EN' });
  });

  it('fantasias: código curto, brilhante e mesmo id ao longo da evolução', () => {
    const charmander = pg(4, 'charmander', 'Charmander', {
      costumes: [
        { slug: 'chapeu-de-festa', name: 'Chapéu de festa', shiny: false, evolvesTo: [] },
        { slug: 'goggles-2026', name: 'Goggles 2026', shiny: true, evolvesTo: [{ path: '/pt-br/pokemon/5-charmeleon', slug: 'goggles-2026' }] },
      ],
    });
    const charmeleon = pg(5, 'charmeleon', 'Charmeleon', {
      evolvesFrom: 'Charmander',
      costumes: [
        { slug: 'chapeu-de-festa', name: 'Chapéu de festa', shiny: true, evolvesTo: [] },
        { slug: 'goggles-2026', name: 'Goggles 2026', shiny: true, evolvesTo: [] },
      ],
    });
    const { species } = table([src(charmander), src(charmeleon)]);
    const [a, b] = species;
    expect(a!.costumes.map((t) => [t.code, t.shiny])).toEqual([['CHAP', false], ['GOGG', true]]);
    expect(a!.costumes[1]!.id).toBe(b!.costumes[1]!.id);
    expect(a!.costumes[0]!.id).not.toBe(b!.costumes[0]!.id);
  });

  it('fantasias com nomes parecidos não colidem no código', () => {
    const p = pg(25, 'pikachu', 'Pikachu', {
      costumes: [
        { slug: 'baloes-verdes', name: 'Balões verdes', shiny: false, evolvesTo: [] },
        { slug: 'baloes-roxos', name: 'Balões roxos', shiny: false, evolvesTo: [] },
      ],
    });
    const { species } = table([src(p)]);
    expect(species[0]!.costumes.map((t) => t.code)).toEqual(['BALO', 'BAL2']);
    expect(validateSpeciesTable(collectionOf(species))).toEqual([]);
  });

  it('não duplica a forma padrão, ignora formas Macho/Fêmea e resolve pré-evolução com forma', () => {
    const burmy = pg(412, 'burmy', 'Burmy', { defaultForm: 'Manto vegetal' });
    const plant = pg(412, 'burmy', 'Burmy', { path: '/pt-br/pokemon/412-burmy/manto-vegetal' });
    const sandy = pg(412, 'burmy', 'Burmy', { path: '/pt-br/pokemon/412-burmy/manto-de-areia' });
    const wormadam = pg(413, 'wormadam', 'Wormadam', { defaultForm: 'Manto vegetal', evolvesFrom: 'Burmy (Manto vegetal)' });
    const wSandy = pg(413, 'wormadam', 'Wormadam', { path: '/pt-br/pokemon/413-wormadam/manto-de-areia', evolvesFrom: 'Burmy (Manto de areia)' });
    const frillish = pg(592, 'frillish', 'Frillish', { defaultForm: 'Macho' });
    const femea = pg(592, 'frillish', 'Frillish', { path: '/pt-br/pokemon/592-frillish/femea' });
    const g = new Map([[412, 8], [413, 8], [592, 4]]);
    const { species, warnings } = buildSpeciesTable(
      [
        src(burmy, [{ label: 'Manto vegetal', page: plant }, { label: 'Manto de areia', page: sandy }]),
        src(wormadam, [{ label: 'Manto de areia', page: wSandy }]),
        src(frillish, [{ label: 'Fêmea', page: femea }]),
      ],
      g,
      [],
    );
    expect(warnings).toEqual([]);
    expect(species.map((s) => [s.id, s.name, s.evolvesFrom])).toEqual([
      ['burmy', 'Burmy', undefined],
      ['burmy-areia', 'Burmy (Manto de areia)', undefined],
      ['wormadam', 'Wormadam', 'burmy'],
      ['wormadam-areia', 'Wormadam (Manto de areia)', 'burmy-areia'],
      ['frillish', 'Frillish', undefined],
    ]);
  });

  it('código de forma ignora prefixos comuns (Padrão, Manto, Forma)', () => {
    const viv = pg(666, 'vivillon', 'Vivillon', { defaultForm: 'Padrão Prado' });
    const forms = ['Padrão Arquipélago', 'Padrão Continental', 'Manto de Lixo'].map((label) => ({
      label,
      page: pg(666, 'vivillon', 'Vivillon', { path: `/pt-br/pokemon/666-vivillon/${label}` }),
    }));
    const { species } = buildSpeciesTable([src(viv, forms)], new Map([[666, 4]]), []);
    expect(species.map((s) => s.form ?? '')).toEqual(['', 'AR', 'CO', 'LI']);
  });

  it('forma evolui da forma de mesmo nome da pré-evolução', () => {
    const ponyta = pg(77, 'ponyta', 'Ponyta');
    const ponytaG = pg(77, 'ponyta', 'Ponyta', { path: '/pt-br/pokemon/77-ponyta/forma-de-galar' });
    const rapidash = pg(78, 'rapidash', 'Rapidash', { evolvesFrom: 'Ponyta' });
    const rapidashG = pg(78, 'rapidash', 'Rapidash', { path: '/pt-br/pokemon/78-rapidash/forma-de-galar', evolvesFrom: 'Ponyta' });
    const { species } = table([
      src(ponyta, [{ label: 'Forma de Galar', page: ponytaG }]),
      src(rapidash, [{ label: 'Forma de Galar', page: rapidashG }]),
    ]);
    expect(species.find((s) => s.id === 'rapidash-galar')!.evolvesFrom).toBe('ponyta-galar');
    expect(species.find((s) => s.id === 'rapidash')!.evolvesFrom).toBe('ponyta');
  });

  it('fantasia "N" (letra do Unown) não colide com a vaga TN', () => {
    const unown = pg(201, 'unown', 'Unown', { costumes: [{ slug: 'n', name: 'N', shiny: true, evolvesTo: [] }] });
    const { species } = buildSpeciesTable([src(unown)], new Map([[201, -1]]), []);
    expect(species[0]!.costumes[0]!.code).not.toBe('N');
    expect(validateSpeciesTable(collectionOf(species))).toEqual([]);
  });

  it('forma que evolui da própria espécie (Zygarde 10% → 50%) não aponta para si mesma', () => {
    const z = pg(718, 'zygarde', 'Zygarde', { defaultForm: 'Forma 10%' });
    const z50 = pg(718, 'zygarde', 'Zygarde', { path: '/pt-br/pokemon/718-zygarde/forma-50', evolvesFrom: 'Zygarde' });
    const { species } = buildSpeciesTable([src(z, [{ label: 'Forma 50%', page: z50 }])], new Map([[718, -1]]), []);
    expect(species.map((s) => [s.id, s.evolvesFrom])).toEqual([['zygarde', undefined], ['zygarde-50', 'zygarde']]);
    expect(validateSpeciesTable(collectionOf(species))).toEqual([]);
  });
});
