import { validateSpeciesTable } from './chain';
import { costumeCode, trackNewSlots, updateSpecies } from './events';
import type { Collection, Exemplar, Species } from './types';

function findExemplar(c: Collection, id: string): Exemplar {
  const e = c.exemplars.find((x) => x.id === id);
  if (!e) throw new Error(`Exemplar não encontrado: ${id}`);
  return e;
}

function assertSpecies(c: Collection, speciesId: string): void {
  if (!c.species.some((s) => s.id === speciesId)) throw new Error(`Espécie desconhecida: ${speciesId}`);
}

export function addExemplar(c: Collection, e: Exemplar): Collection {
  if (c.exemplars.some((x) => x.id === e.id)) throw new Error(`Exemplar já existe: ${e.id}`);
  assertSpecies(c, e.speciesId);
  return { ...c, exemplars: [...c.exemplars, e] };
}

/** Edita qualquer campo; vagas, status e renomeações são recalculados por `computeCollection`. */
export function updateExemplar(c: Collection, id: string, patch: Partial<Omit<Exemplar, 'id'>>): Collection {
  findExemplar(c, id);
  if (patch.speciesId) assertSpecies(c, patch.speciesId);
  return { ...c, exemplars: c.exemplars.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}

/** Troca o exemplar inteiro (mesmo id), permitindo limpar campos opcionais. */
export function replaceExemplar(c: Collection, e: Exemplar): Collection {
  findExemplar(c, e.id);
  assertSpecies(c, e.speciesId);
  return { ...c, exemplars: c.exemplars.map((x) => (x.id === e.id ? e : x)) };
}

export function removeExemplar(c: Collection, id: string): Collection {
  findExemplar(c, id);
  return { ...c, exemplars: c.exemplars.filter((x) => x.id !== id) };
}

/** Marca que o exemplar já foi renomeado no jogo. */
export function confirmRename(c: Collection, id: string, nickname: string | null): Collection {
  findExemplar(c, id);
  return {
    ...c,
    exemplars: c.exemplars.map((x) => {
      if (x.id !== id) return x;
      const { nickname: _old, ...rest } = x;
      return nickname ? { ...rest, nickname } : rest;
    }),
  };
}

function assertValid(c: Collection): Collection {
  const errors = validateSpeciesTable(c);
  if (errors.length) throw new Error(errors.join('\n'));
  return c;
}

export function addSpecies(c: Collection, sp: Species): Collection {
  return trackNewSlots(c, assertValid({ ...c, species: [...c.species, sp] }));
}

// Esses campos formam o prefixo do ID da vaga: mudá-los mudaria IDs existentes.
const FROZEN: (keyof Species)[] = ['id', 'dex', 'form'];

export function editSpecies(c: Collection, id: string, patch: Partial<Species>): Collection {
  for (const k of FROZEN) {
    if (k in patch) throw new Error(`"${k}" não pode ser editado: mudaria IDs de vaga. Cadastre outra espécie.`);
  }
  return trackNewSlots(c, assertValid(updateSpecies(c, id, (s) => ({ ...s, ...patch }))));
}

/**
 * Atualiza a tabela de espécies com uma tabela nova (ex.: a embutida no app) sem perder nada:
 * acrescenta espécies e fantasias, só liga marcações (nunca desliga) e atualiza atributos base.
 * A espécie é reconhecida pelo id ou pelo Nº + forma; IDs de vaga existentes não mudam.
 */
export function mergeSpeciesTable(c: Collection, incoming: Species[]): Collection {
  const key = (s: Pick<Species, 'dex' | 'form'>) => `${s.dex}:${s.form ?? ''}`;
  const byId = new Map(c.species.map((s) => [s.id, s]));
  const byKey = new Map(c.species.map((s) => [key(s), s]));
  const finalId = new Map(incoming.map((s) => [s.id, (byId.get(s.id) ?? byKey.get(key(s)))?.id ?? s.id]));

  const merged = new Map(c.species.map((s) => [s.id, s]));
  for (const inc of incoming) {
    const id = finalId.get(inc.id)!;
    const evolvesFrom = inc.evolvesFrom ? finalId.get(inc.evolvesFrom) ?? inc.evolvesFrom : undefined;
    const old = merged.get(id);
    if (!old) {
      merged.set(id, { ...inc, id, ...(evolvesFrom ? { evolvesFrom } : {}) });
      continue;
    }
    const codes = old.costumes.map((t) => t.code);
    const extra = inc.costumes
      .filter((t) => !old.costumes.some((o) => o.id === t.id))
      .map((t) => {
        const code = codes.includes(t.code) ? costumeCode(t.name, codes) : t.code;
        codes.push(code);
        return { ...t, code };
      });
    merged.set(id, {
      ...old,
      ...(old.evolvesFrom || evolvesFrom ? { evolvesFrom: old.evolvesFrom ?? evolvesFrom } : {}),
      shiny: old.shiny || inc.shiny,
      mega: old.mega || inc.mega,
      dynamax: old.dynamax || inc.dynamax,
      gigamax: old.gigamax || inc.gigamax,
      base: inc.base.atk ? inc.base : old.base,
      costumes: [...old.costumes, ...extra],
    });
  }
  return assertValid({ ...c, species: [...merged.values()] });
}

/** Marca as novas vagas abertas como vistas (todas, ou só as informadas). */
export function acknowledgeOpenedSlots(c: Collection, ids?: string[]): Collection {
  return { ...c, openedSlots: ids ? (c.openedSlots ?? []).filter((x) => !ids.includes(x)) : [] };
}

/** Avisos de dados inconsistentes (não impedem salvar). */
export function exemplarWarnings(c: Collection, e: Exemplar): string[] {
  const sp = c.species.find((s) => s.id === e.speciesId);
  if (!sp) return [`Espécie desconhecida: ${e.speciesId}`];
  const w: string[] = [];
  if (e.lucky && e.origin === 'capturado') w.push('Sortudo sempre vem de troca: confira a origem.');
  if (sp.gender === 'sem' && e.sex) w.push(`${sp.name} não tem sexo.`);
  if (sp.gender === 'macho' && e.sex === 'femea') w.push(`${sp.name} só existe macho: confira o sexo.`);
  if (sp.gender === 'femea' && e.sex === 'macho') w.push(`${sp.name} só existe fêmea: confira o sexo.`);
  if (sp.gender === 'ambos' && !e.sex) w.push('Informe o sexo.');
  if (e.costumeId && !sp.costumes.some((t) => t.id === e.costumeId)) w.push(`Traje "${e.costumeId}" não está cadastrado para ${sp.name}.`);
  if (e.backgroundId && !c.backgrounds.some((b) => b.id === e.backgroundId)) w.push(`Fundo "${e.backgroundId}" não está cadastrado.`);
  return w;
}
