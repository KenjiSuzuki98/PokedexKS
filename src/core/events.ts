import { generateSlots } from './slots';
import type { Background, BackgroundType, Collection, CustomCategory, GameEvent, Since, Slot, Species } from './types';

function normalize(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function slugify(name: string): string {
  return normalize(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Símbolos que aparecem sozinhos em nomes (ex.: Unown "!" e "?").
const SYMBOL_NAMES: Record<string, string> = { '!': 'EXCLAMACAO', '?': 'INTERROGACAO' };

/** Código curto e legível a partir de um nome; com colisão, troca o fim por um número. */
export function makeCode(name: string, taken: string[], length = 4): string {
  const letters = normalize(name).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const base = (letters || SYMBOL_NAMES[name.trim()] || 'X').slice(0, length);
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = String(n);
    const code = base.slice(0, length - suffix.length) + suffix;
    if (!taken.includes(code)) return code;
  }
}

// "T" + código vira o ID da vaga do traje: o código "N" daria "TN", que já é "não sortudo".
const RESERVED_COSTUME_CODES = ['N'];

/** Código de traje que não colide com os da espécie nem com vagas fixas. */
export function costumeCode(name: string, taken: string[]): string {
  return makeCode(name, [...taken, ...RESERVED_COSTUME_CODES]);
}

/** Registra em `openedSlots` as vagas que existem em `after` e não existiam em `before`. */
export function trackNewSlots(before: Collection, after: Collection): Collection {
  const fresh = diffSlots(generateSlots(before), generateSlots(after)).map((s) => s.id);
  if (fresh.length === 0) return after;
  const opened = after.openedSlots ?? [];
  return { ...after, openedSlots: [...opened, ...fresh.filter((id) => !opened.includes(id))] };
}

export function updateSpecies(c: Collection, speciesId: string, fn: (s: Species) => Species): Collection {
  if (!c.species.some((s) => s.id === speciesId)) throw new Error(`Espécie desconhecida: ${speciesId}`);
  return { ...c, species: c.species.map((s) => (s.id === speciesId ? fn(s) : s)) };
}

export function addCostume(
  c: Collection,
  speciesId: string,
  t: { name: string; shiny: boolean; costumeId?: string; since?: Since },
): Collection {
  const id = t.costumeId ?? slugify(t.name);
  const next = updateSpecies(c, speciesId, (s) => {
    if (s.costumes.some((x) => x.id === id)) return s;
    const code = costumeCode(t.name, s.costumes.map((x) => x.code));
    return { ...s, costumes: [...s.costumes, { id, code, name: t.name, shiny: t.shiny, ...(t.since ? { since: t.since } : {}) }] };
  });
  return trackNewSlots(c, next);
}

const BG_LETTER: Record<BackgroundType, string> = { localidade: 'L', especial: 'S', aventura: 'A' };

/** Cadastra um fundo (ou estende um existente com o mesmo nome a mais espécies). */
export function registerBackground(
  c: Collection,
  b: { name: string; type: BackgroundType; speciesId?: string; species?: string[] | 'todas'; since?: Since },
): { collection: Collection; background: Background } {
  const species: string[] | 'todas' = b.species ?? (b.speciesId ? [b.speciesId] : []);
  const existing = c.backgrounds.find((x) => slugify(x.name) === slugify(b.name));
  if (existing) {
    const merged: Background = {
      ...existing,
      species: existing.species === 'todas' || species === 'todas' ? 'todas' : [...new Set([...existing.species, ...species])],
    };
    const next = { ...c, backgrounds: c.backgrounds.map((x) => (x === existing ? merged : x)) };
    return { collection: trackNewSlots(c, next), background: merged };
  }
  const letter = BG_LETTER[b.type];
  const n = c.backgrounds.filter((x) => x.type === b.type).length + 1;
  const background: Background = {
    id: slugify(b.name),
    code: letter + n,
    name: b.name,
    type: b.type,
    species,
    ...(b.since ? { since: b.since } : {}),
  };
  return { collection: trackNewSlots(c, { ...c, backgrounds: [...c.backgrounds, background] }), background };
}

function assertUniqueSlots(c: Collection): void {
  const seen = new Set<string>();
  for (const s of generateSlots(c)) {
    if (seen.has(s.id)) throw new Error(`ID de vaga repetido: ${s.id}`);
    seen.add(s.id);
  }
}

export function addCustomCategory(
  c: Collection,
  cat: { name: string; species: string[] | 'todas'; values: { name: string; code: string }[]; since?: Since },
): Collection {
  for (const v of cat.values) {
    if (!/^[A-Z0-9]{1,7}$/.test(v.code)) throw new Error(`Código inválido: ${v.code}`);
  }
  const category: CustomCategory = {
    id: slugify(cat.name),
    name: cat.name,
    species: cat.species,
    values: cat.values.map((v) => ({ id: slugify(v.name), code: v.code, name: v.name, ...(cat.since ? { since: cat.since } : {}) })),
  };
  if (c.customCategories.some((x) => x.id === category.id)) throw new Error(`Categoria já existe: ${cat.name}`);
  const next = { ...c, customCategories: [...c.customCategories, category] };
  assertUniqueSlots(next);
  return trackNewSlots(c, next);
}

/** Registra (ou atualiza) um evento. Sem ativar, não mexe na tabela. */
export function addEvent(c: Collection, ev: GameEvent): Collection {
  const others = c.events.filter((x) => x.id !== ev.id);
  return { ...c, events: [...others, ev].sort((a, b) => a.start.localeCompare(b.start)) };
}

export function diffSlots(before: Slot[], after: Slot[]): Slot[] {
  const old = new Set(before.map((s) => s.id));
  return after.filter((s) => !old.has(s.id));
}

/** Ativa o evento: aplica o que ele trouxe na tabela e devolve as vagas novas. */
export function activateEvent(c: Collection, eventId: string): { collection: Collection; newSlots: Slot[] } {
  const ev = c.events.find((x) => x.id === eventId);
  if (!ev) throw new Error(`Evento desconhecido: ${eventId}`);
  if (ev.active) return { collection: c, newSlots: [] };

  const since: Since = { eventId: ev.id, date: ev.start };
  let next = c;
  for (const t of ev.brings.costumes ?? []) next = addCostume(next, t.speciesId, { ...t, since });
  for (const b of ev.brings.backgrounds ?? []) next = registerBackground(next, { ...b, since }).collection;
  for (const id of ev.brings.shinyDebuts ?? []) {
    next = updateSpecies(next, id, (s) => (s.shiny ? s : { ...s, shiny: true, shinySince: since }));
  }
  for (const f of ev.brings.forms ?? []) {
    next = updateSpecies(next, f.speciesId, (s) =>
      s[f.form] ? s : { ...s, [f.form]: true, formsSince: { ...s.formsSince, [f.form]: since } },
    );
  }
  for (const cat of ev.brings.categories ?? []) next = addCustomCategory(next, { ...cat, since });
  next = trackNewSlots(c, { ...next, events: next.events.map((x) => (x.id === eventId ? { ...x, active: true } : x)) });

  return { collection: next, newSlots: diffSlots(generateSlots(c), generateSlots(next)) };
}
