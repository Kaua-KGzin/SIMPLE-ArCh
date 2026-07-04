import { useState } from 'react';
import { api } from '../lib/api';
import type { ChecklistItem } from '../types';

/**
 * Checklist de uma task. Recebe os itens (que já vêm no payload da task) e
 * chama a API para adicionar/marcar/remover. Cada mudança faz o backend
 * re-emitir a task no board, então o progresso propaga em tempo real —
 * aqui só otimizamos o estado local para resposta imediata.
 */
export function TaskChecklist({
  workspaceId,
  taskId,
  items,
  onChange,
}: {
  workspaceId: string;
  taskId: string;
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const base = `/workspaces/${workspaceId}/tasks/${taskId}/checklist`;

  const done = items.filter((i) => i.done).length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const item = await api<ChecklistItem>(base, {
        method: 'POST',
        body: JSON.stringify({ text: text.trim() }),
      });
      onChange([...items, item]);
      setText('');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: ChecklistItem) {
    onChange(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await api(`${base}/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ done: !item.done }),
      });
    } catch {
      onChange(items); // reverte se falhar
    }
  }

  async function remove(item: ChecklistItem) {
    onChange(items.filter((i) => i.id !== item.id));
    await api(`${base}/${item.id}`, { method: 'DELETE' }).catch(() => onChange(items));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Checklist {items.length > 0 && `(${done}/${items.length})`}
        </p>
        {items.length > 0 && (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${(done / items.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group/ci flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => void toggle(item)}
              className="h-3.5 w-3.5 shrink-0 accent-green-500"
            />
            <span className={`flex-1 ${item.done ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
              {item.text}
            </span>
            <button
              onClick={() => void remove(item)}
              title="Remover item"
              className="hidden shrink-0 text-zinc-600 hover:text-red-400 group-hover/ci:block"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Adicionar item…"
          maxLength={300}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-indigo-500"
        />
        <button
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-lg bg-zinc-700 px-3 py-1 text-xs hover:bg-zinc-600 disabled:opacity-40"
        >
          +
        </button>
      </form>
    </div>
  );
}
