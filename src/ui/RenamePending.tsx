import { confirmRename } from '../core/ops';
import { useCollection } from './context';
import { CopyButton } from './CopyButton';
import { formatIV, speciesName } from './format';

export function RenamePending({ onOpen }: { onOpen?: (id: string) => void }) {
  const { collection: c, result: r, update } = useCollection();
  const pending = r.renamePending;
  if (pending.length === 0) return <p>Nenhuma renomeação pendente.</p>;

  return (
    <table>
      <thead>
        <tr><th>Exemplar</th><th>Apelido atual</th><th>Novo apelido</th><th /></tr>
      </thead>
      <tbody>
        {pending.map((p) => {
          const e = c.exemplars.find((x) => x.id === p.exemplarId)!;
          return (
            <tr key={p.exemplarId}>
              <td>
                <button type="button" className="link" onClick={() => onOpen?.(e.id)}>{speciesName(c, e.speciesId)}</button>{' '}
                <small className="muted">{formatIV(e)}</small>
              </td>
              <td>{p.from ? <code>{p.from}</code> : <span className="muted">sem apelido</span>}</td>
              <td>
                {p.to ? (
                  <>
                    <code>{p.to}</code> <CopyButton text={p.to} />
                  </>
                ) : (
                  <span className="muted">remover apelido</span>
                )}
              </td>
              <td>
                <button type="button" onClick={() => update((col) => confirmRename(col, p.exemplarId, p.to))}>Feito</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
