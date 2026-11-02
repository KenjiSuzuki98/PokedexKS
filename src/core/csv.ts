import { percentOf } from './iv/parse';
import type { Collection, Exemplar, Rocket, Sex, Species } from './types';

/** CSV simples com aspas; separador vírgula ou ponto e vírgula (detectado pela 1ª linha). */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) endField();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else field += ch;
  }
  if (field !== '' || row.length) endRow();
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9♀♂]/g, '');

const COLUMNS = {
  name: ['name', 'nome'],
  form: ['form', 'forma'],
  number: ['pokemonnumber', 'number', 'dex'],
  gender: ['gender', 'sexo'],
  cp: ['cp', 'pc'],
  atk: ['atkiv', 'attackiv'],
  def: ['defiv', 'defenseiv'],
  sta: ['staiv', 'staminaiv', 'hpiv'],
  catchDate: ['catchdate', 'datacaptura'],
  lucky: ['lucky', 'sortudo'],
  rocket: ['shadowpurified', 'shadow'],
} as const;

export interface CSVImportResult {
  exemplars: Exemplar[];
  errors: { line: number; message: string }[];
}

export interface CSVImportOptions {
  newId: () => string;
  /** Data provisória (AAAA-MM-DD) quando o CSV não traz a data de captura. */
  today: string;
  /** Formato de datas com barra: dia/mês (padrão) ou mês/dia. */
  dateFormat?: 'dmy' | 'mdy';
}

function parseDate(s: string, format: 'dmy' | 'mdy'): string | null {
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!m) return null;
  const [a, b] = [m[1]!, m[2]!];
  const [day, month] = format === 'dmy' ? [a, b] : [b, a];
  const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  if (Number(month) > 12 || Number(day) > 31) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseSex(s: string): Sex | null {
  const v = normalize(s);
  if (['♂', 'm', 'male', 'macho'].includes(v)) return 'macho';
  if (['♀', 'f', 'female', 'femea'].includes(v)) return 'femea';
  return null;
}

const ROCKET: Record<string, Rocket> = { '1': 'sombroso', '2': 'purificado' };

function findSpecies(table: Species[], name: string, number: string, form: string): Species | undefined {
  const formLetter = form.trim() ? normalize(form)[0]!.toUpperCase() : '';
  if (number.trim()) {
    const dex = Number(number);
    const sameDex = table.filter((s) => s.dex === dex);
    return sameDex.find((s) => (s.form ?? '') === formLetter) ?? (formLetter ? undefined : sameDex[0]);
  }
  return table.find((s) => normalize(s.name) === normalize(name) && (s.form ?? '') === formLetter);
}

/**
 * Importa a exportação do Poke Genie. O que o CSV não traz (tamanho, traje, fundo, brilhante,
 * origem, data, e sexo quando ausente) entra com valor provisório e fica em `pendingFields`.
 */
export function importPokeGenieCSV(text: string, c: Collection, opts: CSVImportOptions): CSVImportResult {
  const [head, ...rows] = parseCSV(text);
  const idx = new Map((head ?? []).map((h, i) => [normalize(h), i]));
  const col = (key: keyof typeof COLUMNS) => COLUMNS[key].map((k) => idx.get(k)).find((i) => i !== undefined);
  const cols = Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, col(k as keyof typeof COLUMNS)])) as Record<
    keyof typeof COLUMNS,
    number | undefined
  >;
  if (cols.name === undefined && cols.number === undefined) throw new Error('CSV sem coluna de espécie (Name ou Pokemon Number).');

  const result: CSVImportResult = { exemplars: [], errors: [] };
  rows.forEach((row, i) => {
    const line = i + 2;
    const get = (key: keyof typeof COLUMNS) => (cols[key] === undefined ? '' : (row[cols[key]!] ?? '').trim());
    const sp = findSpecies(c.species, get('name'), get('number'), get('form'));
    if (!sp) {
      result.errors.push({ line, message: `Espécie não encontrada na tabela: ${get('name') || get('number')} ${get('form')}`.trim() });
      return;
    }

    const stats = [get('atk'), get('def'), get('sta')];
    let iv: Exemplar['iv'];
    if (stats.every((s) => s !== '')) {
      const [atk, def, sta] = stats.map(Number) as [number, number, number];
      if (![atk, def, sta].every((v) => Number.isInteger(v) && v >= 0 && v <= 15)) {
        result.errors.push({ line, message: `IV inválido: ${stats.join('/')}` });
        return;
      }
      iv = { atk, def, sta, percent: percentOf(atk, def, sta) };
    }

    const pending: string[] = ['size', 'costume', 'background', 'shiny'];
    const lucky = get('lucky') === '1' || normalize(get('lucky')) === 'true';
    if (!lucky) pending.push('origin');
    const date = get('catchDate') ? parseDate(get('catchDate'), opts.dateFormat ?? 'dmy') : null;
    if (!date) pending.push('date');

    let sex: Sex | null = null;
    if (sp.gender === 'macho' || sp.gender === 'femea') sex = sp.gender;
    else if (sp.gender === 'ambos') {
      sex = parseSex(get('gender'));
      if (!sex) pending.push('sex');
    }

    const cp = Number(get('cp'));
    result.exemplars.push({
      id: opts.newId(),
      speciesId: sp.id,
      ...(get('cp') && Number.isFinite(cp) ? { cp } : {}),
      ...(iv ? { iv } : {}),
      origin: lucky ? 'troca' : 'capturado',
      date: date ?? opts.today,
      sex,
      size: 'normal',
      shiny: false,
      lucky,
      rocket: ROCKET[get('rocket')] ?? 'normal',
      pendingFields: pending,
    });
  });
  return result;
}
