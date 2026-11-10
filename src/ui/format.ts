import type { AttrKey } from '../core/query';
import type { Collection, Exemplar } from '../core/types';

export const ATTR_LABELS: Record<AttrKey, string> = {
  evolucao: 'Evolução',
  cadeia: 'Cadeia',
  especie: 'Espécie',
  dex: 'Nº Pokédex',
  iv: 'IV',
  cp: 'CP',
  data: 'Data',
  status: 'Status',
  origem: 'Origem',
  sexo: 'Sexo',
  tamanho: 'Tamanho',
  brilhante: 'Brilhante',
  sortudo: 'Sortudo',
  rocket: 'Rocket',
  traje: 'Traje',
  fundo: 'Fundo',
  evento: 'Evento de origem',
  codigo: 'Código (renomear)',
  inclusao: 'Data de inclusão',
};

export function speciesName(c: Collection, id: string): string {
  return c.species.find((s) => s.id === id)?.name ?? id;
}

export function formatIV(e: Exemplar): string {
  if (!e.iv) return '—';
  const p = Math.round(e.iv.percent);
  return e.iv.estimated ? `~${p}%` : `${p}%`;
}

export function formatStats(e: Exemplar): string {
  const iv = e.iv;
  if (!iv || iv.atk === undefined) return iv?.estimated ? 'IV estimado' : iv?.noDetail ? 'IV sem detalhe' : '';
  return `${iv.atk}/${iv.def}/${iv.sta}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Nº da Pokédex com 4 dígitos + letra de forma, como no ID das vagas. */
export function dexLabel(c: Collection, speciesId: string): string {
  const sp = c.species.find((s) => s.id === speciesId);
  return sp ? String(sp.dex).padStart(4, '0') + (sp.form ?? '') : '—';
}
