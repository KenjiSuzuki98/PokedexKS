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

  // Na vaga de uma fase, quem já está nela (ou mais perto dela) ganha de qualquer reserva; depois o IV.
  const phasePriority = (a: Exemplar, b: Exemplar) => {
    const da = byId.get(a.speciesId);
    const db = byId.get(b.speciesId);
    return (db ? depth(db, byId) : 0) - (da ? depth(da, byId) : 0) || compareExemplars(a, b);
  };

  const committed = new Map<string, string>();
  const eligibleFor = (phase: Species) =>
    (byRoot.get(rootOf(phase.id)) ?? []).filter((e) => {
      const at = committed.get(e.id);
      return (at === undefined || at === phase.id) && canReach(e, phase, byId);
    });

  /** Vagas da fase e quem ganha cada uma, entre os exemplares colocados nela. */
  function evalPhase(phase: Species, members: Exemplar[]): { winners: Map<string, Slot[]>; filled: number } {
    const sorted = [...members].sort(phasePriority);
    const winners = new Map<string, Slot[]>();
    let filled = 0;
    for (const slot of slotsBySpecies.get(phase.id) ?? []) {
      const w = sorted.find((e) => matchesSlot(e, slot));
      if (!w) continue;
      filled += 1;
      winners.set(w.id, [...(winners.get(w.id) ?? []), slot]);
    }
    return { winners, filled };
  }

  // 1) Distribuição inicial: fases mais altas primeiro (o maior IV vai para a maior evolução).
  // Entre ramos da mesma altura e da mesma família (Eevee), vai primeiro o ramo com menos
  // candidatos, para a reserva ocupar um ramo livre em vez de tirar a vaga de quem já evoluiu.
  const groups = new Map<string, { depth: number; phases: Species[] }>();
  for (const sp of c.species) {
    if (!byRoot.has(rootOf(sp.id))) continue;
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
      for (const id of evalPhase(phase, eligibleFor(phase)).winners.keys()) committed.set(id, phase.id);
    }
  }

  // 2) Sem desperdício: move um exemplar de fase quando isso mantém mais exemplares na coleção
  // ou, mantendo os mesmos, preenche mais vagas.
  const familyPhases = new Map<string, Species[]>();
  for (const sp of c.species) {
    const root = rootOf(sp.id);
    if (byRoot.has(root)) familyPhases.set(root, [...(familyPhases.get(root) ?? []), sp]);
  }
  for (const [root, members] of byRoot) {
    const phases = familyPhases.get(root) ?? [];
    if (members.length < 2 || phases.length < 2) continue;
    const placed = new Map<string, string | undefined>(members.map((e) => [e.id, committed.get(e.id)]));
    const inPhase = (pid: string) => members.filter((e) => placed.get(e.id) === pid);
    const scoreOf = (pid: string | undefined) => {
      if (!pid) return [0, 0] as const;
      const r = evalPhase(byId.get(pid)!, inPhase(pid));
      return [r.winners.size, r.filled] as const;
    };
    for (let round = 0, improved = true; improved && round < 20; round++) {
      improved = false;
      // Os de menor IV tentam mudar primeiro: o maior IV continua indo para a maior evolução.
      for (const e of [...members].reverse()) {
        const from = placed.get(e.id);
        for (const to of phases) {
          if (to.id === from || !canReach(e, to, byId)) continue;
          const before = [scoreOf(from), scoreOf(to.id)];
          placed.set(e.id, to.id);
          const after = [scoreOf(from), scoreOf(to.id)];
          const kept = after[0]![0] + after[1]![0] - before[0]![0] - before[1]![0];
          const filled = after[0]![1] + after[1]![1] - before[0]![1] - before[1]![1];
          if (kept > 0 || (kept === 0 && filled > 0)) {
            improved = true;
            break;
          }
          placed.set(e.id, from);
        }
      }
    }
    for (const e of members) {
      const pid = placed.get(e.id);
      if (pid) committed.set(e.id, pid);
      else committed.delete(e.id);
    }
  }

  // 3) Resultado final por fase.
  const occupancy: Record<string, string | null> = {};
  const won = new Map<string, Slot[]>();
  for (const slot of slots) occupancy[slot.id] = null;
  const phaseMembers = new Map<string, Exemplar[]>();
  for (const e of c.exemplars) {
    const pid = committed.get(e.id);
    if (pid) phaseMembers.set(pid, [...(phaseMembers.get(pid) ?? []), e]);
  }
  for (const [pid, members] of phaseMembers) {
    for (const [id, list] of evalPhase(byId.get(pid)!, members).winners) {
      won.set(id, list);
      for (const s of list) occupancy[s.id] = id;
    }
  }
  for (const e of c.exemplars) if (!won.has(e.id)) committed.delete(e.id);

  const exemplars: Record<string, ExemplarResult> = {};
  const renamePending: RenamePending[] = [];
  for (const e of c.exemplars) {
    const mine = won.get(e.id) ?? [];
    const phaseId = committed.get(e.id);
    const traded = e.origin === 'troca' || e.lucky;
    const status: Status = mine.length > 0 ? 'manter' : traded ? 'descartar' : 'trocar';
    // Apelido fixo: se o exemplar já foi renomeado e ainda ocupa aquela vaga, não pede outra renomeação.
    const best = mine.find((s) => s.id === e.nickname) ?? [...mine].sort((a, b) => nicknameRank(a) - nicknameRank(b))[0];
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
