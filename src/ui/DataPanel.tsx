import { useState } from 'react';
import { exportBackup, importBackup } from '../core/backup';
import { importPokeGenieCSV, type CSVImportResult } from '../core/csv';
import { useCollection } from './context';
import { newId, today as todayISO } from './format';

function browserDownload(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function DataPanel({ download = browserDownload, today }: { download?: (name: string, content: string) => void; today?: string }) {
  const { collection: c, update, replace } = useCollection();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [monthFirst, setMonthFirst] = useState(false);
  const [csvResult, setCsvResult] = useState<CSVImportResult | null>(null);
  const date = today ?? todayISO();

  async function onBackup(file: File | undefined) {
    if (!file) return;
    setMessage('');
    setError('');
    try {
      const next = importBackup(await readFile(file));
      if (!window.confirm('Substituir toda a coleção atual pelo backup?')) return;
      replace(next);
      setMessage(`Backup importado: ${next.exemplars.length} exemplares.`);
    } catch (err) {
      setError(`Não foi possível importar: ${(err as Error).message}`);
    }
  }

  async function onCSV(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const text = await readFile(file);
      const result = importPokeGenieCSV(text, c, { newId, today: date, dateFormat: monthFirst ? 'mdy' : 'dmy' });
      update((col) => ({ ...col, exemplars: [...col.exemplars, ...result.exemplars] }));
      setCsvResult(result);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="data">
      <h3>Backup</h3>
      <button type="button" onClick={() => download(`pokedex-ks-backup-${date}.json`, exportBackup(c))}>
        Exportar backup
      </button>
      <label>
        Importar backup (JSON)
        <input type="file" accept="application/json,.json" onChange={(e) => onBackup(e.target.files?.[0])} />
      </label>

      <h3>Importar CSV (Poke Genie)</h3>
      <label className="check">
        <input type="checkbox" checked={monthFirst} onChange={(e) => setMonthFirst(e.target.checked)} />
        Datas no formato mês/dia
      </label>
      <label>
        Importar CSV
        <input type="file" accept=".csv,text/csv" onChange={(e) => onCSV(e.target.files?.[0])} />
      </label>
      {csvResult && (
        <div>
          <p>
            {csvResult.exemplars.length} importado(s), {csvResult.errors.length} erro(s). Os campos que o CSV não traz ficaram
            pendentes em cada exemplar.
          </p>
          {csvResult.errors.length > 0 && (
            <ul className="warn">
              {csvResult.errors.map((e) => (
                <li key={e.line}>Linha {e.line}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {message && <p>{message}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}
