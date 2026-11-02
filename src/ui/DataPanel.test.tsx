// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { CURRENT_SCHEMA, exportBackup } from '../core/backup';
import { collection, ex, iv } from '../core/test-helpers';
import { DataPanel } from './DataPanel';
import { renderWith } from './test-utils';

const file = (content: string, name: string) => new File([content], name, { type: 'text/plain' });

describe('DataPanel', () => {
  it('exporta backup versionado', async () => {
    const download = vi.fn();
    const c = collection({ exemplars: [ex({ speciesId: 'raichu', iv: iv(90) })] });
    const { user } = renderWith(<DataPanel download={download} today="2026-11-02" />, c);
    await user.click(screen.getByRole('button', { name: /exportar backup/i }));
    const [name, content] = download.mock.calls[0]!;
    expect(name).toBe('pokedex-ks-backup-2026-11-02.json');
    expect(JSON.parse(content)).toMatchObject({ schemaVersion: CURRENT_SCHEMA, data: c });
  });

  it('importa backup substituindo a coleção depois de confirmar', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const saved = collection({ exemplars: [ex({ speciesId: 'pikachu', iv: iv(50) })] });
    const r = renderWith(<DataPanel />, collection());
    await r.user.upload(screen.getByLabelText(/importar backup/i), file(exportBackup(saved), 'b.json'));
    expect(await screen.findByText(/backup importado/i)).toBeInTheDocument();
    expect(r.collection).toEqual(saved);
    confirm.mockRestore();
  });

  it('backup inválido mostra erro e não muda nada', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const c = collection();
    const r = renderWith(<DataPanel />, c);
    await r.user.upload(screen.getByLabelText(/importar backup/i), file('lixo', 'b.json'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(r.collection).toBe(c);
    confirm.mockRestore();
  });

  it('importa CSV do Poke Genie e lista erros por linha', async () => {
    const csv = [
      'Index,Name,Form,Pokemon Number,Gender,CP,HP,Atk IV,Def IV,Sta IV',
      '1,Pikachu,,25,♀,812,82,15,14,14',
      '2,Mewtwo,,150,,4000,150,15,15,15',
    ].join('\n');
    const r = renderWith(<DataPanel today="2026-11-02" />, collection());
    await r.user.upload(screen.getByLabelText(/importar csv/i), file(csv, 'pg.csv'));
    expect(await screen.findByText(/1 importado/i)).toBeInTheDocument();
    expect(screen.getByText(/linha 3.*Mewtwo/i)).toBeInTheDocument();
    expect(r.collection.exemplars).toEqual([expect.objectContaining({ speciesId: 'pikachu', cp: 812, date: '2026-11-02' })]);
  });
});
