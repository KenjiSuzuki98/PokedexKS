// Tipos do domínio. Tudo aqui é dado puro (serializável em JSON).

export type GenderRule = 'ambos' | 'macho' | 'femea' | 'sem';
export type Sex = 'macho' | 'femea';
export type Size = 'normal' | 'xxl' | 'xxs';
export type Rocket = 'normal' | 'sombroso' | 'purificado';
export type Origin = 'capturado' | 'troca';
export type PotentialForm = 'mega' | 'dynamax' | 'gigamax';
export type BackgroundType = 'localidade' | 'especial' | 'aventura';

/** Data ISO (AAAA-MM-DD) ou id de evento de onde a coisa veio. */
export interface Since {
  date?: string;
  eventId?: string;
}

export interface Costume {
  /** Compartilhado entre espécies da cadeia: o exemplar só evolui com traje se a fase seguinte tem o mesmo id. */
  id: string;
  /** Código curto usado no ID da vaga. Gerado uma vez e nunca recalculado. */
  code: string;
  name: string;
  shiny: boolean;
  since?: Since;
}

export interface Species {
  id: string;
  name: string;
  dex: number;
  /** Letra de forma regional (ex.: 'A' para Alola), entra no ID da vaga. */
  form?: string;
  evolvesFrom?: string;
  gender: GenderRule;
  shiny: boolean;
  shinySince?: Since;
  mega: boolean;
  dynamax: boolean;
  gigamax: boolean;
  formsSince?: Partial<Record<PotentialForm, Since>>;
  costumes: Costume[];
  base: { atk: number; def: number; sta: number };
}

export interface Background {
  id: string;
  code: string;
  name: string;
  type: BackgroundType;
  species: string[] | 'todas';
  since?: Since;
}

export interface CustomValue {
  id: string;
  code: string;
  name: string;
  since?: Since;
}

/** Categoria de vaga criada pelo usuário. O exemplar guarda o valor em `extra[categoria.id]`. */
export interface CustomCategory {
  id: string;
  name: string;
  species: string[] | 'todas';
  values: CustomValue[];
}

export interface EventBrings {
  costumes?: { speciesId: string; name: string; shiny: boolean; costumeId?: string }[];
  backgrounds?: { name: string; type: BackgroundType; species: string[] | 'todas' }[];
  shinyDebuts?: string[];
  forms?: { speciesId: string; form: PotentialForm }[];
  categories?: { name: string; species: string[] | 'todas'; values: { name: string; code: string }[] }[];
}

export interface GameEvent {
  id: string;
  name: string;
  start: string;
  end: string;
  description: string;
  active: boolean;
  brings: EventBrings;
}

export interface IV {
  atk?: number;
  def?: number;
  sta?: number;
  /** 0 a 100. */
  percent: number;
  /** Faixa vinda da calculadora: `percent` é o valor médio. */
  estimated?: boolean;
  /** Só a porcentagem foi informada. */
  noDetail?: boolean;
}

export interface Exemplar {
  id: string;
  /** Fase atual da cadeia (evolução atual). */
  speciesId: string;
  cp?: number;
  iv?: IV;
  origin: Origin;
  /** Data de captura ou recebimento (AAAA-MM-DD). */
  date: string;
  sex?: Sex | null;
  size: Size;
  shiny: boolean;
  lucky: boolean;
  rocket: Rocket;
  costumeId?: string | null;
  backgroundId?: string | null;
  dynamax?: boolean;
  gigamax?: boolean;
  extra?: Record<string, string>;
  eventId?: string;
  notes?: string;
  /** Apelido que está hoje no jogo. */
  nickname?: string;
  /** Campos que ainda faltam completar (ex.: vindos de CSV). */
  pendingFields?: string[];
}

export interface Collection {
  species: Species[];
  backgrounds: Background[];
  customCategories: CustomCategory[];
  events: GameEvent[];
  exemplars: Exemplar[];
  /** IDs de vagas novas que ainda não vi ("novas vagas abertas"). */
  openedSlots?: string[];
}

export interface Slot {
  /** ID da vaga, usado como apelido no jogo. */
  id: string;
  speciesId: string;
  category: string;
  value: string;
  label: string;
  since?: Since;
}

export type Status = 'manter' | 'trocar' | 'descartar';
