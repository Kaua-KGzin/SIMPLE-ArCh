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
  const [justChecked, setJustChecked] = useState<string | null>(null);
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
    if (!item.done) {
      setJustChecked(item.id);
      window.setTimeout(() => setJustChecked((cur) => (cur === item.id ? null : cur)), 320);
    }
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
        <p className="text-[10.5px] font-bold uppercase tracking-[.05em] text-faint">
          Checklist {items.length > 0 && `(${done}/${items.length})`}
        </p>
        {items.length > 0 && (
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#1a1a22]">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${(done / items.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group/ci flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => void toggle(item)}
              className={`h-[13px] w-[13px] shrink-0 accent-green-500 ${justChecked === item.id ? 'check-pop' : ''}`}
            />
            <span className={`flex-1 ${item.done ? 'text-faint-3 line-through' : 'text-soft'}`}>
              {item.text}
            </span>
            <button
              onClick={() => void remove(item)}
              title="Remover item"
              className="hidden shrink-0 text-faint-3 hover:text-red-400 group-hover/ci:block"
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
          className="min-w-0 flex-1 rounded-[7px] border border-line-input bg-base-2 px-2 py-1.5 text-[11.5px] text-ink outline-none focus:border-brand-violet"
        />
        <button
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-[7px] bg-raised px-3 text-soft transition hover:brightness-125 disabled:opacity-40"
        >
          +
        </button>
      </form>
    </div>
  );
}
