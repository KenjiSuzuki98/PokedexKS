import { chainRoot, depth, speciesMap } from './chain';
import { generateSlots, matchesSlot } from './slots';
import type { Collection, Exemplar, Slot, Species, Status } from './types';

export interface ExemplarResult {
  exemplarId: string;
  /** IDs das vagas que ocupa. */
  slots: string[];
  /** Fase em que o exemplar foi colocado (pode ser acima da atual). */
  phaseId?: string;
  /** Preenchido quando o exemplar está aguardando evolução. */
  reservedFor?: string;
  status: Status;
  /** Apelido que o exemplar deve ter no jogo (null = sem apelido de vaga). */
  nickname: string | null;
}

export interface RenamePending {
  exemplarId: string;
  from: string | null;
  to: string | null;
}

export interface CollectionResult {
  slots: Slot[];
  /** vaga → exemplar que a ocupa (ou null se livre). */
  occupancy: Record<string, string | null>;
  exemplars: Record<string, ExemplarResult>;
  renamePending: RenamePending[];
}

/** Pontuação de IV de 0 a 100; usa os três valores quando existem. */
export function ivScore(e: Exemplar): number {
  const iv = e.iv;
  if (!iv) return -1;
  if (iv.atk !== undefined && iv.def !== undefined && iv.sta !== undefined) return ((iv.atk + iv.def + iv.sta) / 45) * 100;
  return iv.percent;
}

/** Ordem de preferência: maior IV, depois o mais antigo, depois o id (para ser determinístico). */
export function compareExemplars(a: Exemplar, b: Exemplar): number {
  return ivScore(b) - ivScore(a) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}

/** O exemplar pode chegar a esta fase (ela é a atual ou uma evolução, e o traje acompanha)? */
function canReach(e: Exemplar, target: Species, byId: Map<string, Species>): boolean {
  if (e.costumeId && !target.costumes.some((t) => t.id === e.costumeId)) return false;
  let cur: Species | undefined = target;
  while (cur) {
    if (cur.id === e.speciesId) return true;
    cur = cur.evolvesFrom ? byId.get(cur.evolvesFrom) : undefined;
  }
  return false;
}

// Vagas mais "raras" primeiro na hora de escolher o apelido; EV é a base.
const NICKNAME_PRIORITY = ['traje', 'raridade', 'troca', 'rocket', 'fundo', 'tamanho', 'potencial'];
const BUILTIN = new Set([...NICKNAME_PRIORITY, 'evolucao', 'sexo']);

function nicknameRank(s: Slot): number {
  const plain = s.value === 'normal' || s.value === 'nenhum' || s.value === 'mega';
  if (!plain) {
    const i = NICKNAME_PRIORITY.indexOf(s.category);
    if (i >= 0) return s.category === 'traje' && s.value.endsWith(':brilhante') ? -1 : i;
    if (!BUILTIN.has(s.category)) return NICKNAME_PRIORITY.length; // categoria criada pelo usuário
  }
  if (s.category === 'evolucao') return 100;
  return 200;
}

export function computeCollection(c: Collection): CollectionResult {
  const byId = speciesMap(c);
  const slots = generateSlots(c);
  const slotsBySpecies = new Map<string, Slot[]>();
  for (const s of slots) {
    const list = slotsBySpecies.get(s.speciesId);
    if (list) list.push(s);
    else slotsBySpecies.set(s.speciesId, [s]);
  }

  // Exemplares só disputam vagas da própria família: agrupa pela espécie base.
  const rootOf = (speciesId: string) => {
    const sp = byId.get(speciesId);
    return sp ? chainRoot(sp, byId).id : speciesId;
  };
  const byRoot = new Map<string, Exemplar[]>();
  for (const e of [...c.exemplars].sort(compareExemplars)) {
    const root = rootOf(e.speciesId);
    byRoot.set(root, [...(byRoot.get(root) ?? []), e]);
  }

  const occupancy: Record<string, string | null> = {};
  const committed = new Map<string, string>();
  const won = new Map<string, Slot[]>();
  const eligibleFor = (phase: Species) =>
    (byRoot.get(rootOf(phase.id)) ?? []).filter((e) => {
      const at = committed.get(e.id);
      return (at === undefined || at === phase.id) && canReach(e, phase, byId);
    });

  // Fases mais altas primeiro: o maior IV vai para a maior evolução.
  // Entre ramos da mesma altura e da mesma família (Eevee), vai primeiro o ramo com menos
  // candidatos, para a reserva ocupar um ramo livre em vez de tirar a vaga de quem já evoluiu.
  const groups = new Map<string, { depth: number; phases: Species[] }>();
  for (const sp of c.species) {
    const d = depth(sp, byId);
    const key = `${d}|${rootOf(sp.id)}`;
    const g = groups.get(key) ?? { depth: d, phases: [] };
    g.phases.push(sp);
    groups.set(key, g);
  }
  const ordered = [...groups.values()].sort((a, b) => b.depth - a.depth);

  for (const g of ordered) {
    const pending = [...g.phases].sort((a, b) => a.id.localeCompare(b.id));
    while (pending.length) {
      const counts = pending.map((p) => eligibleFor(p).length);
      const i = counts.indexOf(Math.min(...counts));
      const phase = pending.splice(i, 1)[0]!;
      assignPhase(phase, eligibleFor(phase));
    }
  }

  function assignPhase(phase: Species, eligible: Exemplar[]): void {
    for (const slot of slotsBySpecies.get(phase.id) ?? []) {
      const winner = eligible.find((e) => matchesSlot(e, slot));
      occupancy[slot.id] = winner?.id ?? null;
      if (!winner) continue;
      committed.set(winner.id, phase.id);
      won.set(winner.id, [...(won.get(winner.id) ?? []), slot]);
    }
  }

  const exemplars: Record<string, ExemplarResult> = {};
  const renamePending: RenamePending[] = [];
  for (const e of c.exemplars) {
    const mine = won.get(e.id) ?? [];
    const phaseId = committed.get(e.id);
    const traded = e.origin === 'troca' || e.lucky;
    const status: Status = mine.length > 0 ? 'manter' : traded ? 'descartar' : 'trocar';
    const best = [...mine].sort((a, b) => nicknameRank(a) - nicknameRank(b))[0];
    const nickname = best?.id ?? null;
    exemplars[e.id] = {
      exemplarId: e.id,
      slots: mine.map((s) => s.id),
      ...(phaseId ? { phaseId } : {}),
      ...(phaseId && phaseId !== e.speciesId ? { reservedFor: phaseId } : {}),
      status,
      nickname,
    };
    const current = e.nickname || null;
    if (current !== nickname) renamePending.push({ exemplarId: e.id, from: current, to: nickname });
  }

  return { slots, occupancy, exemplars, renamePending };
}
