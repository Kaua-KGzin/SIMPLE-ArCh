import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { confirmDialog } from '../lib/confirm';
import { textOn } from '../lib/task-meta';
import type { Label } from '../types';

// Paleta padrão para novas etiquetas — cores distinguíveis em tema escuro.
const SWATCHES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

/**
 * Painel lateral de etiquetas do workspace: cria (nome + cor) e apaga.
 * Apagar uma etiqueta remove o vínculo de todas as tasks (cascade no banco).
 */
export function LabelsPanel({
  workspaceId,
  onClose,
  onChanged,
}: {
  workspaceId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/workspaces/${workspaceId}/labels`;

  useEffect(() => {
    api<Label[]>(base).then(setLabels).catch((e) => setError(e.message));
  }, [base]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const label = await api<Label>(base, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), color }),
      });
      setLabels((ls) => [...ls, label].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(label: Label) {
    const ok = await confirmDialog({
      title: `Apagar a etiqueta "${label.name}"?`,
      message: 'Ela será removida de todas as tasks que a usam.',
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`${base}/${label.id}`, { method: 'DELETE' });
      setLabels((ls) => ls.filter((l) => l.id !== label.id));
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <aside className="panel-in fixed inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Etiquetas ({labels.length})</h2>
        <button onClick={onClose} className="text-faint transition hover:text-soft">✕</button>
      </div>

      {error && <p className="mb-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

      <form onSubmit={create} className="mb-5 space-y-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da etiqueta"
          required
          maxLength={40}
          className="w-full rounded-[10px] border border-line-input bg-base-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand-violet"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              title={c}
              style={{ backgroundColor: c }}
              className={`h-[22px] w-[22px] rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-panel' : 'opacity-70 hover:opacity-100'}`}
            />
          ))}
          <button disabled={saving} className="btn-brand ml-auto rounded-[10px] px-4 py-2 text-sm">
            {saving ? '…' : 'Criar'}
          </button>
        </div>
      </form>

      <ul className="space-y-2">
        {labels.length === 0 && <p className="text-xs text-faint">Nenhuma etiqueta ainda.</p>}
        {labels.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <span
              className="flex-1 truncate rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: l.color, color: textOn(l.color) }}
            >
              {l.name}
            </span>
            <button
              onClick={() => remove(l)}
              title="Apagar etiqueta"
              className="text-faint-3 transition hover:text-red-400"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
