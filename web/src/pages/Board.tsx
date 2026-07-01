import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { MembersPanel } from '../components/MembersPanel';
import { ActivityPanel } from '../components/ActivityPanel';
import { CodeModal } from '../components/CodeModal';
import type { Member, Task, TaskStatus, Workspace } from '../types';

const COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
  { status: 'BACKLOG', label: 'Backlog', accent: 'border-t-zinc-500' },
  { status: 'TODO', label: 'A Fazer', accent: 'border-t-blue-500' },
  { status: 'IN_PROGRESS', label: 'Em Andamento', accent: 'border-t-yellow-500' },
  { status: 'IN_REVIEW', label: 'Em Revisão', accent: 'border-t-purple-500' },
  { status: 'DONE', label: 'Concluído', accent: 'border-t-green-500' },
];

/**
 * Board Kanban do workspace. Mover task = arrastar o card para outra coluna
 * (HTML5 drag & drop nativo). Atribuição de responsável direto no card.
 */
export function Board() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [codeTask, setCodeTask] = useState<string | null>(null); // task do modal de código
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null); // card expandido

  useEffect(() => {
    if (!workspaceId) return;
    api<Workspace>(`/workspaces/${workspaceId}`)
      .then((ws) => {
        setWorkspace(ws);
        setMembers(ws.members ?? []);
      })
      .catch((e) => setError(e.message));
    api<Task[]>(`/workspaces/${workspaceId}/tasks`).then(setTasks).catch((e) => setError(e.message));
  }, [workspaceId]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const task = await api<Task>(`/workspaces/${workspaceId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title, description: description || undefined }),
      });
      setTasks((prev) => [task, ...prev]);
      setShowForm(false);
      setTitle('');
      setDescription('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    const prev = tasks;
    // Atualização OTIMISTA: move na UI já; se a API falhar, desfazemos.
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await api(`/workspaces/${workspaceId}/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      setTasks(prev);
      setError((e as Error).message);
    }
  }

  async function assignTask(taskId: string, assigneeId: string | null) {
    try {
      const updated = await api<Task>(`/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ assigneeId }),
      });
      setTasks((ts) => ts.map((t) => (t.id === taskId ? updated : t)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300">← Workspaces</Link>
          <h1 className="text-2xl font-bold">{workspace?.name ?? '…'}</h1>
          {workspace?.githubRepoFullName && (
            <a
              href={`https://github.com/${workspace.githubRepoFullName}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ⑂ {workspace.githubRepoFullName}
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Avatares da equipe (resumo) */}
          <button onClick={() => setShowMembers(true)} className="flex -space-x-2" title="Equipe">
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} user={m.user} size={8} />
            ))}
            {members.length > 4 && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs">
                +{members.length - 4}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowMembers(true)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500"
          >
            Equipe
          </button>
          <button
            onClick={() => setShowActivity(true)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500"
          >
            Atividade
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
          >
            {showForm ? 'Cancelar' : '+ Nova task'}
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-950 px-4 py-2 text-sm text-red-300" onClick={() => setError(null)}>
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={createTask} className="mb-6 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da task (vira o título da Issue no GitHub)"
            required
            maxLength={200}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={3}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Criando (Issue no GitHub)…' : 'Criar task'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const taskId = e.dataTransfer.getData('taskId');
                if (taskId) void moveTask(taskId, col.status);
              }}
              className={`rounded-xl border-t-2 ${col.accent} bg-zinc-900/60 p-3 transition ${
                dragOver === col.status ? 'bg-zinc-800' : ''
              }`}
            >
              <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-zinc-300">
                {col.label}
                <span className="text-xs text-zinc-500">{colTasks.length}</span>
              </h2>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                    onClick={() => setOpenTask((cur) => (cur === task.id ? null : task.id))}
                    className="cursor-grab rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm shadow transition hover:border-zinc-600 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{task.title}</p>
                      {task.assignee && <Avatar user={task.assignee} size={5} />}
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs">
                      {task.githubIssueNumber != null && workspace?.githubRepoFullName && (
                        <a
                          href={`https://github.com/${workspace.githubRepoFullName}/issues/${task.githubIssueNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-zinc-500 hover:text-indigo-400"
                        >
                          #{task.githubIssueNumber}
                        </a>
                      )}
                      {task.githubPrNumber != null && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCodeTask(task.id); }}
                          title={`Ver diff do PR #${task.githubPrNumber}`}
                          className="font-mono text-zinc-500 hover:text-green-400"
                        >
                          {'</>'} PR #{task.githubPrNumber}
                        </button>
                      )}
                    </div>

                    {openTask === task.id && (
                      <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3" onClick={(e) => e.stopPropagation()}>
                        {task.description && (
                          <p className="whitespace-pre-wrap text-xs text-zinc-400">{task.description}</p>
                        )}
                        <label className="block text-xs text-zinc-500">
                          Responsável
                          <select
                            value={task.assigneeId ?? ''}
                            onChange={(e) => void assignTask(task.id, e.target.value || null)}
                            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                          >
                            <option value="">— ninguém —</option>
                            {members.map((m) => (
                              <option key={m.user.id} value={m.user.id}>
                                {m.user.name ?? m.user.githubLogin}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showActivity && workspaceId && (
        <ActivityPanel workspaceId={workspaceId} onClose={() => setShowActivity(false)} />
      )}

      {codeTask && workspaceId && (
        <CodeModal workspaceId={workspaceId} taskId={codeTask} onClose={() => setCodeTask(null)} />
      )}

      {showMembers && workspaceId && (
        <MembersPanel
          workspaceId={workspaceId}
          members={members}
          onChange={setMembers}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}
