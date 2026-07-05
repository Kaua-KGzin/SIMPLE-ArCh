import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { confirmDialog } from '../lib/confirm';
import { toast } from '../lib/toast';
import { PRIORITY_ORDER, PRIORITY_META, textOn } from '../lib/task-meta';
import type { Label, Task, TaskPriority } from '../types';

/** ISO (ou null) -> "yyyy-mm-dd" para o <input type="date">. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Modal de edição da task: título, descrição, prioridade, prazo e etiquetas.
 * Título/descrição também são espelhados na Issue do GitHub pelo backend.
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
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [labelIds, setLabelIds] = useState<Set<string>>(
    new Set((task.labels ?? []).map((l) => l.labelId)),
  );
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Label[]>(`/workspaces/${workspaceId}/labels`).then(setAllLabels).catch(() => {});
  }, [workspaceId]);

  const sortedLabels = useMemo(
    () => [...allLabels].sort((a, b) => a.name.localeCompare(b.name)),
    [allLabels],
  );

  function toggleLabel(id: string) {
    setLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await api<Task>(`/workspaces/${workspaceId}/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          description,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          labelIds: [...labelIds],
        }),
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
    const ok = await confirmDialog({
      title: `Apagar a task "${task.title}"?`,
      message: task.githubIssueNumber != null
        ? `A Issue #${task.githubIssueNumber} no GitHub será fechada.`
        : 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Apagar task',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/workspaces/${workspaceId}/tasks/${task.id}`, { method: 'DELETE' });
      toast.success('Task apagada.');
      onDeleted(task.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(4,4,7,.75)] p-4 sm:p-6" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="dialog-in max-h-[90vh] w-full max-w-lg space-y-3.5 overflow-y-auto rounded-[18px] border border-line-2 bg-panel p-5 sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Editar task</h2>
          <button type="button" onClick={onClose} className="text-faint transition hover:text-soft">✕</button>
        </div>

        {error && <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="w-full rounded-[10px] border border-line-input bg-base-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-violet"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Descrição"
          className="w-full resize-y rounded-[10px] border border-line-input bg-base-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-violet"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-[11px] text-faint">
            Prioridade
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="mt-1 w-full rounded-lg border border-line-input bg-base-2 px-2 py-2 text-[12.5px] text-ink-2"
            >
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>{PRIORITY_META[p].label}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-faint">
            Prazo
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-input bg-base-2 px-2 py-1.5 text-[12.5px] text-ink-2"
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-[11px] text-faint">Etiquetas</p>
          {sortedLabels.length === 0 ? (
            <p className="text-xs text-faint">Nenhuma etiqueta no workspace ainda — crie em “Etiquetas”.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {sortedLabels.map((l) => {
                const on = labelIds.has(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    style={on ? { backgroundColor: l.color, color: textOn(l.color) } : undefined}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${
                      on ? '' : 'border border-line-2 text-soft-2 hover:border-faint'
                    }`}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {task.githubIssueNumber != null && (
          <p className="text-xs text-faint">
            Título e descrição são espelhados na Issue #{task.githubIssueNumber} do GitHub.
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-[10px] border border-[#5c1f26] px-4 py-2 text-[12.5px] font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            Apagar task
          </button>
          <button disabled={busy} className="btn-brand rounded-[10px] px-5 py-2 text-[13px]">
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
