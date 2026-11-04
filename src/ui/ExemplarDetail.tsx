import { useState } from 'react';
import { confirmRename, removeExemplar } from '../core/ops';
import { useCollection } from './context';
import { CopyButton } from './CopyButton';
import { ExemplarForm } from './ExemplarForm';
import { dexLabel, formatIV, formatStats, speciesName } from './format';
import { regionOf } from '../core/region';

export function ExemplarDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { collection: c, result: r, update } = useCollection();
  const [editing, setEditing] = useState(false);
  const e = c.exemplars.find((x) => x.id === id);
  const res = r.exemplars[id];
  if (!e || !res) return <p>Exemplar não encontrado.</p>;

  if (editing) {
    return (
      <section>
        <h2>Editar {speciesName(c, e.speciesId)}</h2>
        <ExemplarForm exemplarId={id} onDone={() => setEditing(false)} />
        <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
      </section>
    );
  }

  const slots = r.slots.filter((s) => res.slots.includes(s.id));
  const sp = c.species.find((s) => s.id === e.speciesId);
  const needsRename = (e.nickname || null) !== res.nickname;

  return (
    <section className="detail">
      <button type="button" className="link" onClick={onClose}>← voltar</button>
      <h2>
        {speciesName(c, e.speciesId)}{' '}
        <small>
          #{dexLabel(c, e.speciesId)} · {regionOf(sp?.dex ?? 0)} · {formatIV(e)} {formatStats(e)}
        </small>
      </h2>
      {res.status === 'manter' ? (
        <p className="rename">
          Renomear para: <code>{res.nickname}</code>
          <CopyButton text={res.nickname!} />
          {res.reservedFor && <span className="muted"> aguardando evolução → {speciesName(c, res.reservedFor)}</span>}
          {e.nickname && e.nickname !== res.nickname && <span className="muted"> (hoje no jogo: {e.nickname})</span>}
        </p>
      ) : (
        <p className={`status ${res.status}`}>
          {res.status === 'trocar' ? 'Fora da Pokédex — troca' : 'Fora da Pokédex — descarte'}
          {e.nickname && <span className="muted"> (tire o apelido {e.nickname} no jogo)</span>}
        </p>
      )}
      {needsRename && (
        <button type="button" onClick={() => update((col) => confirmRename(col, id, res.nickname))}>
          Já renomeei
        </button>
      )}
      <h3 id="vagas">Vagas que ocupa ({slots.length})</h3>
      <ul aria-labelledby="vagas">
        {slots.map((s) => (
          <li key={s.id}>
            <code>{s.id}</code> {s.label}
          </li>
        ))}
      </ul>
      {e.pendingFields?.length ? <p className="warn">Faltam completar: {e.pendingFields.join(', ')}</p> : null}
      {e.notes && <p>{e.notes}</p>}
      <div className="actions">
        <button type="button" onClick={() => setEditing(true)}>Editar</button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (!window.confirm('Excluir este exemplar?')) return;
            update((col) => removeExemplar(col, id));
            onClose();
          }}
        >
          Excluir
        </button>
      </div>
    </section>
  );
}
