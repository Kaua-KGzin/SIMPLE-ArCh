import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { MembersPanel } from '../components/MembersPanel';
import { ActivityPanel } from '../components/ActivityPanel';
import { CodeModal } from '../components/CodeModal';
import { TaskEditModal } from '../components/TaskEditModal';
import { TaskComments } from '../components/TaskComments';
import { displayName, type Member, type Task, type TaskStatus, type Workspace } from '../types';

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: 'BACKLOG', label: 'Backlog', dot: 'bg-zinc-400' },
  { status: 'TODO', label: 'A Fazer', dot: 'bg-blue-400' },
  { status: 'IN_PROGRESS', label: 'Em Andamento', dot: 'bg-yellow-400' },
  { status: 'IN_REVIEW', label: 'Em Revisão', dot: 'bg-purple-400' },
  { status: 'DONE', label: 'Concluído', dot: 'bg-green-400' },
];

const POLL_MS = 5000; // atualização "quase tempo real" do board

/**
 * Board Kanban do workspace.
 * - Auto-atualização via polling: mudanças vindas do GitHub (webhooks)
 *   aparecem sozinhas, sem F5.
 * - Drag & drop entre colunas com atualização otimista.
 * - Busca + filtro por responsável.
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
  const [codeTask, setCodeTask] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);

  // Pausa o polling enquanto uma ação otimista está em voo (evita "pulo" visual).
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!workspaceId || busyRef.current) return;
    try {
      const ts = await api<Task[]>(`/workspaces/${workspaceId}/tasks`);
      if (!busyRef.current) setTasks(ts);
    } catch {
      /* silencioso: rede pode oscilar entre polls */
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    api<Workspace>(`/workspaces/${workspaceId}`)
      .then((ws) => {
        setWorkspace(ws);
        setMembers(ws.members ?? []);
      })
      .catch((e) => setError(e.message));
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [workspaceId, refresh]);

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (assigneeFilter && t.assigneeId !== assigneeFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !`#${t.githubIssueNumber}`.includes(q)) return false;
      return true;
    });
  }, [tasks, search, assigneeFilter]);

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
    busyRef.current = true;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await api(`/workspaces/${workspaceId}/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      setTasks(prev);
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
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
    <div className="min-h-screen px-6 py-6">
      {/* ===== Header ===== */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300">← Workspaces</Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{workspace?.name ?? '…'}</h1>
            {workspace?.githubRepoFullName && (
              <a
                href={`https://github.com/${workspace.githubRepoFullName}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              >
                ⑂ {workspace.githubRepoFullName}
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowMembers(true)} className="mr-1 flex -space-x-2" title="Equipe">
            {members.slice(0, 4).map((m) => <Avatar key={m.id} user={m.user} size={8} />)}
            {members.length > 4 && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs">
                +{members.length - 4}
              </span>
            )}
          </button>
          <button onClick={() => setShowMembers(true)} className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm hover:border-zinc-500">
            Equipe
          </button>
          <button onClick={() => setShowActivity(true)} className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm hover:border-zinc-500">
            Atividade
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium shadow-lg shadow-indigo-950 hover:bg-indigo-500"
          >
            {showForm ? 'Cancelar' : '+ Nova task'}
          </button>
        </div>
      </header>

      {/* ===== Filtros ===== */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou #issue…"
          className="w-64 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-indigo-500"
        />
        <div className="flex items-center gap-1.5">
          {members.map((m) => (
            <button
              key={m.user.id}
              onClick={() => setAssigneeFilter((cur) => (cur === m.user.id ? null : m.user.id))}
              title={`Filtrar por ${displayName(m.user)}`}
              className={`rounded-full transition ${
                assigneeFilter === m.user.id ? 'ring-2 ring-indigo-500' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <Avatar user={m.user} size={8} />
            </button>
          ))}
          {assigneeFilter && (
            <button onClick={() => setAssigneeFilter(null)} className="ml-1 text-xs text-zinc-500 hover:text-zinc-200">
              limpar
            </button>
          )}
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          {workspace?.githubRepoFullName ? 'sincronizando com o GitHub' : 'atualização automática'}
        </span>
      </div>

      {error && (
        <p
          className="mb-4 cursor-pointer rounded-lg bg-red-950 px-4 py-2 text-sm text-red-300"
          onClick={() => setError(null)}
          title="Clique para dispensar"
        >
          {error}
        </p>
      )}

      {/* ===== Form nova task ===== */}
      {showForm && (
        <form onSubmit={createTask} className="mb-6 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              workspace?.githubRepoFullName
                ? 'Título da task (vira o título da Issue no GitHub)'
                : 'Título da task'
            }
            required
            maxLength={200}
            autoFocus
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
            {saving ? 'Criando…' : 'Criar task'}
          </button>
        </form>
      )}

      {/* ===== Colunas ===== */}
      <div className="grid grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const colTasks = visibleTasks.filter((t) => t.status === col.status);
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
              className={`flex min-h-[60vh] flex-col rounded-xl bg-zinc-900/50 p-2.5 ring-1 ring-inset transition ${
                dragOver === col.status ? 'bg-zinc-800/80 ring-indigo-600' : 'ring-zinc-800/60'
              }`}
            >
              <h2 className="mb-3 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                {col.label}
                <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                  {colTasks.length}
                </span>
              </h2>

              <div className="flex-1 space-y-2">
                {colTasks.length === 0 && (
                  <p className="px-1 pt-2 text-center text-xs text-zinc-700">— vazio —</p>
                )}
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                    onClick={() => setOpenTask((cur) => (cur === task.id ? null : task.id))}
                    className="group cursor-grab rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm shadow-md transition hover:-translate-y-0.5 hover:border-zinc-600 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug">{task.title}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditTask(task); }}
                        title="Editar task"
                        className="hidden shrink-0 text-zinc-600 hover:text-zinc-200 group-hover:block"
                      >
                        ✎
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-xs">
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
                      {task.assignee && <span className="ml-auto"><Avatar user={task.assignee} size={5} /></span>}
                    </div>

                    {openTask === task.id && (
                      <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3" onClick={(e) => e.stopPropagation()}>
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
                                {displayName(m.user)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {workspaceId && (
                          <TaskComments workspaceId={workspaceId} taskId={task.id} members={members} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Painéis e modais ===== */}
      {showActivity && workspaceId && (
        <ActivityPanel
          workspaceId={workspaceId}
          hasRepo={!!workspace?.githubRepoFullName}
          onClose={() => setShowActivity(false)}
        />
      )}
      {codeTask && workspaceId && (
        <CodeModal workspaceId={workspaceId} taskId={codeTask} onClose={() => setCodeTask(null)} />
      )}
      {editTask && workspaceId && (
        <TaskEditModal
          workspaceId={workspaceId}
          task={editTask}
          onSaved={(t) => setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)))}
          onDeleted={(id) => setTasks((ts) => ts.filter((x) => x.id !== id))}
          onClose={() => setEditTask(null)}
        />
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
