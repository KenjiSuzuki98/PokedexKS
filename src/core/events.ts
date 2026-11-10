import { generateSlots } from './slots';
import type { Background, BackgroundType, Collection, Costume, CustomCategory, EventBrings, GameEvent, Since, Slot, Species } from './types';

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
    // Mesmo id ou mesmo nome: é o mesmo traje, não duplica.
    if (s.costumes.some((x) => x.id === id || slugify(x.name) === slugify(t.name))) return s;
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
  const costumes = (ev.brings.costumes ?? []).map((t) => ({ ...t, costumeId: resolveCostumeId(next, t) }));
  for (const t of costumes) next = addCostume(next, t.speciesId, { ...t, since });
  if (costumes.length) next = { ...next, events: next.events.map((x) => (x.id === eventId ? { ...x, brings: { ...x.brings, costumes } } : x)) };
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

type CostumeEntry = NonNullable<EventBrings['costumes']>[number];

/** Traje da espécie com o mesmo nome (sem acento, maiúsculas ou pontuação). */
export function sameNameCostume(c: Collection, speciesId: string, name: string): Costume | undefined {
  const slug = slugify(name);
  return c.species.find((s) => s.id === speciesId)?.costumes.find((t) => slugify(t.name) === slug);
}

function resolveCostumeId(c: Collection, t: CostumeEntry): string {
  return t.costumeId ?? sameNameCostume(c, t.speciesId, t.name)?.id ?? slugify(t.name);
}

/** Entradas de traje para um evento: a espécie e, se pedido, todas as evoluções dela (mesmo id de traje). */
export function costumeEntries(
  c: Collection,
  t: { speciesId: string; name: string; shiny: boolean },
  withEvolutions: boolean,
): (CostumeEntry & { costumeId: string })[] {
  const costumeId = resolveCostumeId(c, t);
  const ids = [t.speciesId];
  if (withEvolutions) {
    for (let i = 0; i < ids.length; i++) {
      for (const s of c.species) if (s.evolvesFrom === ids[i] && !ids.includes(s.id)) ids.push(s.id);
    }
  }
  return ids.map((speciesId) => ({ speciesId, name: t.name, shiny: t.shiny, costumeId }));
}

const inUse = (n: number, what: string) => new Error(`${what} em uso por ${n} exemplar(es): mude o exemplar antes de remover.`);

/** Muda nome e/ou brilhante do traje em todas as espécies e eventos. O código (e o ID das vagas) não muda. */
export function editCostume(c: Collection, costumeId: string, patch: { name?: string; shiny?: boolean }): Collection {
  const next: Collection = {
    ...c,
    species: c.species.map((s) =>
      s.costumes.some((t) => t.id === costumeId)
        ? { ...s, costumes: s.costumes.map((t) => (t.id === costumeId ? { ...t, ...patch } : t)) }
        : s,
    ),
    events: c.events.map((ev) =>
      ev.brings.costumes?.some((t) => t.costumeId === costumeId)
        ? { ...ev, brings: { ...ev.brings, costumes: ev.brings.costumes.map((t) => (t.costumeId === costumeId ? { ...t, ...patch } : t)) } }
        : ev,
    ),
  };
  return trackNewSlots(c, next);
}

/** Tira o traje de uma espécie (e dos eventos). Recusa se algum exemplar dessa espécie usa o traje. */
export function removeCostume(c: Collection, costumeId: string, speciesId: string): Collection {
  const users = c.exemplars.filter((e) => e.speciesId === speciesId && e.costumeId === costumeId).length;
  const sp = c.species.find((s) => s.id === speciesId);
  const name = sp?.costumes.find((t) => t.id === costumeId)?.name ?? costumeId;
  if (users) throw inUse(users, `Traje ${name} de ${sp?.name ?? speciesId}`);
  const sameEntry = (t: CostumeEntry) => t.costumeId === costumeId && t.speciesId === speciesId;
  return {
    ...updateSpecies(c, speciesId, (s) => ({ ...s, costumes: s.costumes.filter((t) => t.id !== costumeId) })),
    events: c.events.map((ev) =>
      ev.brings.costumes?.some(sameEntry)
        ? { ...ev, brings: { ...ev.brings, costumes: ev.brings.costumes.filter((t) => !sameEntry(t)) } }
        : ev,
    ),
  };
}

const withDate = (since: Since | undefined, eventId: string, date: string): Since | undefined =>
  since?.eventId === eventId ? { ...since, date } : since;

/**
 * Salva a nova versão de um evento. Se ele já está ativo, aplica a diferença na tabela:
 * itens novos criam vagas, itens editados mudam nome/brilhante (sem mudar IDs) e itens tirados saem
 * (recusa se algum exemplar usa).
 */
export function updateEvent(c: Collection, next: GameEvent): Collection {
  const old = c.events.find((x) => x.id === next.id);
  if (!old) throw new Error(`Evento desconhecido: ${next.id}`);
  if (!old.active) {
    const saved = addEvent(c, { ...next, active: false });
    return next.active ? activateEvent(saved, next.id).collection : saved;
  }

  const id = next.id;
  const since: Since = { eventId: id, date: next.start };
  let col = c;

  // Trajes: identificados por espécie + id do traje.
  const key = (t: CostumeEntry) => `${t.speciesId}|${t.costumeId}`;
  const oldCostumes = (old.brings.costumes ?? []).map((t) => ({ ...t, costumeId: resolveCostumeId(c, t) }));
  const newCostumes = (next.brings.costumes ?? []).map((t) => ({ ...t, costumeId: resolveCostumeId(c, t) }));
  for (const t of oldCostumes) if (!newCostumes.some((n) => key(n) === key(t))) col = removeCostume(col, t.costumeId, t.speciesId);
  for (const t of newCostumes) {
    const exists = col.species.find((s) => s.id === t.speciesId)?.costumes.some((x) => x.id === t.costumeId);
    col = exists
      ? updateSpecies(col, t.speciesId, (s) => ({
          ...s,
          costumes: s.costumes.map((x) => (x.id === t.costumeId ? { ...x, name: t.name, shiny: t.shiny, since } : x)),
        }))
      : addCostume(col, t.speciesId, { ...t, since });
  }

  // Fundos: identificados pelo nome.
  const newBgs = next.brings.backgrounds ?? [];
  for (const b of old.brings.backgrounds ?? []) {
    if (newBgs.some((n) => slugify(n.name) === slugify(b.name))) continue;
    const bg = col.backgrounds.find((x) => x.id === slugify(b.name) && x.since?.eventId === id);
    if (!bg) continue;
    const users = col.exemplars.filter((e) => e.backgroundId === bg.id).length;
    if (users) throw inUse(users, `Fundo ${bg.name}`);
    col = { ...col, backgrounds: col.backgrounds.filter((x) => x !== bg) };
  }
  for (const b of newBgs) {
    const bg = col.backgrounds.find((x) => x.id === slugify(b.name));
    col = bg
      ? { ...col, backgrounds: col.backgrounds.map((x) => (x === bg ? { ...x, name: b.name, type: b.type, species: b.species } : x)) }
      : registerBackground(col, { ...b, since }).collection;
  }

  // Estreias de brilhante e formas.
  const debuts = next.brings.shinyDebuts ?? [];
  for (const sid of old.brings.shinyDebuts ?? []) {
    if (debuts.includes(sid)) continue;
    col = updateSpecies(col, sid, (s) => {
      if (s.shinySince?.eventId !== id) return s;
      const { shinySince: _drop, ...rest } = s;
      return { ...rest, shiny: false };
    });
  }
  for (const sid of debuts) col = updateSpecies(col, sid, (s) => (s.shiny ? s : { ...s, shiny: true, shinySince: since }));
  const forms = next.brings.forms ?? [];
  for (const f of old.brings.forms ?? []) {
    if (forms.some((n) => n.speciesId === f.speciesId && n.form === f.form)) continue;
    col = updateSpecies(col, f.speciesId, (s) => {
      if (s.formsSince?.[f.form]?.eventId !== id) return s;
      const formsSince = { ...s.formsSince };
      delete formsSince[f.form];
      return { ...s, [f.form]: false, formsSince };
    });
  }
  for (const f of forms) {
    col = updateSpecies(col, f.speciesId, (s) => (s[f.form] ? s : { ...s, [f.form]: true, formsSince: { ...s.formsSince, [f.form]: since } }));
  }

  // A data de início nova vale como "disponível desde" de tudo que veio do evento.
  col = {
    ...col,
    species: col.species.map((s) => ({
      ...s,
      costumes: s.costumes.map((t) => (t.since?.eventId === id ? { ...t, since: withDate(t.since, id, next.start) } : t)),
      ...(s.shinySince ? { shinySince: withDate(s.shinySince, id, next.start) } : {}),
      ...(s.formsSince
        ? { formsSince: Object.fromEntries(Object.entries(s.formsSince).map(([k, v]) => [k, withDate(v, id, next.start)])) }
        : {}),
    })),
    backgrounds: col.backgrounds.map((b) => (b.since?.eventId === id ? { ...b, since: withDate(b.since, id, next.start) } : b)),
  };

  const saved = addEvent(col, { ...next, active: true, brings: { ...next.brings, costumes: newCostumes } });
  return trackNewSlots(c, saved);
}

/** Exclui o evento. Se estava ativo, desfaz o que ele trouxe (recusa se algo está em uso). */
export function deleteEvent(c: Collection, eventId: string): Collection {
  const ev = c.events.find((x) => x.id === eventId);
  if (!ev) throw new Error(`Evento desconhecido: ${eventId}`);
  const reverted = ev.active ? updateEvent(c, { ...ev, brings: { categories: ev.brings.categories } }) : c;
  const slotIds = new Set(generateSlots(reverted).map((s) => s.id));
  return {
    ...reverted,
    events: reverted.events.filter((x) => x.id !== eventId),
    exemplars: reverted.exemplars.map((e) => {
      if (e.eventId !== eventId) return e;
      const { eventId: _drop, ...rest } = e;
      return rest;
    }),
    ...(reverted.openedSlots ? { openedSlots: reverted.openedSlots.filter((s) => slotIds.has(s)) } : {}),
  };
}
