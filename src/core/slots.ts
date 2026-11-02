import type { Background, Collection, Exemplar, Since, Slot, Species } from './types';

/** Prefixo do ID: Nº Pokédex com 4 dígitos + letra de forma regional. */
export function slotPrefix(sp: Species): string {
  return String(sp.dex).padStart(4, '0') + (sp.form ?? '');
}

function backgroundApplies(bg: Background, speciesId: string): boolean {
  return bg.species === 'todas' || bg.species.includes(speciesId);
}

/** Gera todas as vagas a partir da tabela de espécies, fundos e categorias. */
export function generateSlots(c: Collection): Slot[] {
  const slots: Slot[] = [];
  for (const sp of c.species) {
    const prefix = slotPrefix(sp);
    const add = (category: string, value: string, code: string, label: string, since?: Since) =>
      slots.push({ id: prefix + code, speciesId: sp.id, category, value, label: `${sp.name} ${label}`, ...(since ? { since } : {}) });

    add('evolucao', 'ev', 'EV', '(evolução)');
    if (sp.mega) add('potencial', 'mega', 'MG', 'Mega', sp.formsSince?.mega);
    if (sp.dynamax) add('potencial', 'dynamax', 'DX', 'Dinamax', sp.formsSince?.dynamax);
    if (sp.gigamax) add('potencial', 'gigamax', 'GX', 'Gigamax', sp.formsSince?.gigamax);

    add('rocket', 'normal', 'RN', 'não sombroso');
    add('rocket', 'sombroso', 'SB', 'sombroso');
    add('rocket', 'purificado', 'PU', 'purificado');

    add('troca', 'normal', 'TN', 'não sortudo');
    add('troca', 'sortudo', 'SO', 'sortudo');

    add('raridade', 'normal', 'NB', 'não brilhante');
    if (sp.shiny) add('raridade', 'brilhante', 'BR', 'brilhante', sp.shinySince);

    add('traje', 'nenhum', 'ST', 'sem traje');
    for (const t of sp.costumes) {
      add('traje', t.id, 'T' + t.code, `traje ${t.name}`, t.since);
      if (t.shiny && sp.shiny) add('traje', `${t.id}:brilhante`, 'BT' + t.code, `traje ${t.name} brilhante`, t.since);
    }

    add('fundo', 'nenhum', 'FN', 'sem fundo');
    for (const bg of c.backgrounds) {
      if (backgroundApplies(bg, sp.id)) add('fundo', bg.id, 'F' + bg.code, `fundo ${bg.name}`, bg.since);
    }

    add('tamanho', 'normal', 'MD', 'tamanho normal');
    add('tamanho', 'xxl', 'XXL', 'XXL');
    add('tamanho', 'xxs', 'XXS', 'XXS');

    if (sp.gender === 'ambos') {
      add('sexo', 'macho', 'MA', 'macho');
      add('sexo', 'femea', 'FE', 'fêmea');
    }

    for (const cat of c.customCategories) {
      if (cat.species !== 'todas' && !cat.species.includes(sp.id)) continue;
      for (const v of cat.values) add(cat.id, v.id, v.code, `${cat.name}: ${v.name}`, v.since);
    }
  }
  return slots;
}

/** O exemplar tem os atributos que a vaga pede? (Não olha fase/evolução.) */
export function matchesSlot(e: Exemplar, slot: Slot): boolean {
  switch (slot.category) {
    case 'evolucao':
      return true;
    case 'potencial':
      // Mega: basta a espécie poder; Dinamax/Gigamax são atributos do exemplar.
      if (slot.value === 'mega') return true;
      if (slot.value === 'dynamax') return !!e.dynamax;
      return !!e.gigamax;
    case 'rocket':
      return e.rocket === slot.value;
    case 'troca':
      return e.lucky === (slot.value === 'sortudo');
    case 'raridade':
      return e.shiny === (slot.value === 'brilhante');
    case 'traje': {
      if (slot.value === 'nenhum') return !e.costumeId;
      const [costumeId, shiny] = slot.value.split(':');
      return e.costumeId === costumeId && (shiny ? e.shiny : true);
    }
    case 'fundo':
      return slot.value === 'nenhum' ? !e.backgroundId : e.backgroundId === slot.value;
    case 'tamanho':
      return e.size === slot.value;
    case 'sexo':
      return e.sex === slot.value;
    default:
      return e.extra?.[slot.category] === slot.value;
  }
}
