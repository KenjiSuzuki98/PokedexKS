import { useMemo, useState } from 'react';
import { filterExemplars, sortExemplars, type AttrKey, type Filter, type SortCriterion } from '../core/query';
import type { Collection, Exemplar, Status } from '../core/types';
import { useCollection } from './context';
import { CopyButton } from './CopyButton';
import { ATTR_LABELS, formatIV, formatStats, speciesName } from './format';

const KEYS = Object.keys(ATTR_LABELS) as AttrKey[];
// Atributos com poucos valores, bons para filtro por valor.
const FILTER_KEYS: AttrKey[] = ['cadeia', 'especie', 'origem', 'sexo', 'tamanho', 'brilhante', 'sortudo', 'rocket', 'traje', 'fundo', 'evento'];

/** Valor legível de um atributo, usado no filtro por valor. */
function attrText(c: Collection, e: Exemplar, key: AttrKey): string {
  const sp = c.species.find((s) => s.id === e.speciesId);
  switch (key) {
    case 'cadeia': {
      let root = sp;
      while (root?.evolvesFrom) root = c.species.find((s) => s.id === root!.evolvesFrom);
      return root?.name ?? '';
    }
    case 'especie': return sp?.name ?? e.speciesId;
    case 'origem': return e.origin;
    case 'sexo': return e.sex ?? '—';
    case 'tamanho': return e.size;
    case 'brilhante': return e.shiny ? 'sim' : 'não';
    case 'sortudo': return e.lucky ? 'sim' : 'não';
    case 'rocket': return e.rocket;
    case 'traje': return sp?.costumes.find((t) => t.id === e.costumeId)?.name ?? 'sem traje';
    case 'fundo': return c.backgrounds.find((b) => b.id === e.backgroundId)?.name ?? 'sem fundo';
    case 'evento': return c.events.find((ev) => ev.id === e.eventId)?.name ?? '—';
    default: return '';
  }
}

export function ExemplarList({ status, onOpen }: { status?: Status; onOpen: (id: string) => void }) {
  const { collection: c, result: r } = useCollection();
  const [text, setText] = useState('');
  const [sort1, setSort1] = useState<SortCriterion>({ key: 'evolucao', dir: 'asc' });
  const [sort2, setSort2] = useState<SortCriterion | null>({ key: 'iv', dir: 'desc' });
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [attr, setAttr] = useState<AttrKey | ''>('');
  const [attrValue, setAttrValue] = useState('');

  const filterValues = useMemo(
    () => (attr ? [...new Set(c.exemplars.map((e) => attrText(c, e, attr)))].sort() : []),
    [attr, c],
  );

  const list = useMemo(() => {
    const filters: Filter[] = [];
    const st = status ?? statusFilter;
    if (st) filters.push({ key: 'status', value: st });
    let items = filterExemplars(c, r, c.exemplars, { filters, text });
    if (attr && attrValue !== '') items = items.filter((e) => attrText(c, e, attr) === attrValue);
    return sortExemplars(c, r, items, sort2 ? [sort1, sort2] : [sort1]);
  }, [c, r, status, statusFilter, text, attr, attrValue, sort1, sort2]);

  return (
    <section>
      <div className="toolbar">
        <input type="search" aria-label="Buscar" placeholder="Buscar espécie, apelido ou nota" value={text} onChange={(e) => setText(e.target.value)} />
        <label>
          Ordenar por
          <select value={sort1.key} onChange={(e) => setSort1({ ...sort1, key: e.target.value as AttrKey })}>
            {KEYS.map((k) => <option key={k} value={k}>{ATTR_LABELS[k]}</option>)}
          </select>
        </label>
        <label>
          Direção 1
          <select value={sort1.dir} onChange={(e) => setSort1({ ...sort1, dir: e.target.value as 'asc' | 'desc' })}>
            <option value="asc">crescente</option>
            <option value="desc">decrescente</option>
          </select>
        </label>
        <label>
          Depois por
          <select value={sort2?.key ?? ''} onChange={(e) => setSort2(e.target.value ? { key: e.target.value as AttrKey, dir: sort2?.dir ?? 'desc' } : null)}>
            <option value="">—</option>
            {KEYS.map((k) => <option key={k} value={k}>{ATTR_LABELS[k]}</option>)}
          </select>
        </label>
        <label>
          Direção 2
          <select value={sort2?.dir ?? 'desc'} disabled={!sort2} onChange={(e) => sort2 && setSort2({ ...sort2, dir: e.target.value as 'asc' | 'desc' })}>
            <option value="asc">crescente</option>
            <option value="desc">decrescente</option>
          </select>
        </label>
        {!status && (
          <label>
            Filtrar status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | '')}>
              <option value="">todos</option>
              <option value="manter">manter</option>
              <option value="trocar">trocar</option>
              <option value="descartar">descartar</option>
            </select>
          </label>
        )}
        <label>
          Filtrar por
          <select value={attr} onChange={(e) => { setAttr(e.target.value as AttrKey | ''); setAttrValue(''); }}>
            <option value="">—</option>
            {FILTER_KEYS.map((k) => <option key={k} value={k}>{ATTR_LABELS[k]}</option>)}
          </select>
        </label>
        {attr && (
          <label>
            Valor
            <select value={attrValue} onChange={(e) => setAttrValue(e.target.value)}>
              <option value="">todos</option>
              {filterValues.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
      </div>

      <p className="muted">{list.length} exemplar(es)</p>
      <table>
        <thead>
          <tr>
            <th>Espécie</th><th>CP</th><th>IV</th><th>Status</th><th>Renomear para</th>
          </tr>
        </thead>
        <tbody>
          {list.map((e) => {
            const res = r.exemplars[e.id]!;
            const name = speciesName(c, e.speciesId);
            return (
              <tr key={e.id}>
                <td>
                  <button type="button" className="link" aria-label={`Abrir ${name}`} onClick={() => onOpen(e.id)}>
                    {name}
                  </button>
                  {e.shiny && <span className="tag" title="brilhante">✦</span>}
                  {e.lucky && <span className="tag" title="sortudo">S</span>}
                  {e.pendingFields?.length ? <span className="tag warn" title={`falta: ${e.pendingFields.join(', ')}`}>!</span> : null}
                </td>
                <td>{e.cp ?? '—'}</td>
                <td>
                  <span>{formatIV(e)}</span> <small className="muted">{formatStats(e)}</small>
                </td>
                <td>
                  <span className={`status ${res.status}`}>{res.status}</span>
                  {res.reservedFor && <small className="muted"> aguardando evolução → {speciesName(c, res.reservedFor)}</small>}
                </td>
                <td>
                  {res.nickname ? (
                    <>
                      <code>{res.nickname}</code> <CopyButton text={res.nickname} />
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
