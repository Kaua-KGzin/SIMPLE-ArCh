import { useState } from 'react';
import { api } from '../lib/api';
import type { Task } from '../types';

/**
 * Modal de edição da task. Salvar aqui também atualiza a Issue no GitHub
 * (o backend espelha título/descrição). Apagar fecha a Issue.
 */
export function TaskEditModal({
  workspaceId,
  task,
  onSaved,
  onDeleted,
  onClose,
}: {
  workspaceId: string;
  task: Task;
  onSaved: (t: Task) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await api<Task>(`/workspaces/${workspaceId}/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, description }),
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Apagar a task "${task.title}"? A Issue no GitHub será fechada.`)) return;
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/tasks/${task.id}`, { method: 'DELETE' });
      onDeleted(task.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Editar task</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">✕</button>
        </div>

        {error && <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Descrição"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-zinc-500">As alterações são espelhadas na Issue #{task.githubIssueNumber} do GitHub.</p>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-50"
          >
            Apagar task
          </button>
          <button
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
