import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Avatar } from '../components/Avatar';
import { MembersPanel } from '../components/MembersPanel';
import { LabelsPanel } from '../components/LabelsPanel';
import { ActivityPanel } from '../components/ActivityPanel';
import { CodeModal } from '../components/CodeModal';
import { TaskEditModal } from '../components/TaskEditModal';
import { TaskComments } from '../components/TaskComments';
import { TaskChecklist } from '../components/TaskChecklist';
import { PRIORITY_META, PRIORITY_ORDER, dueState, formatDue, textOn } from '../lib/task-meta';
import {
  displayName,
  type ChecklistItem,
  type Label,
  type Member,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type Workspace,
} from '../types';

const DUE_CLASS: Record<'overdue' | 'soon' | 'later', string> = {
  overdue: 'bg-red-950 text-red-300',
  soon: 'bg-amber-950 text-amber-300',
  later: 'bg-zinc-800 text-zinc-400',
};

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: 'BACKLOG', label: 'Backlog', dot: 'bg-zinc-400' },
  { status: 'TODO', label: 'A Fazer', dot: 'bg-blue-400' },
  { status: 'IN_PROGRESS', label: 'Em Andamento', dot: 'bg-yellow-400' },
  { status: 'IN_REVIEW', label: 'Em Revisão', dot: 'bg-purple-400' },
  { status: 'DONE', label: 'Concluído', dot: 'bg-green-400' },
];

// O WebSocket é o canal primário; o polling é só reconciliação de segurança
// (caso o socket caia sem reconectar). Por isso o intervalo é folgado.
const POLL_MS = 30_000;

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
  const [showLabels, setShowLabels] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [codeTask, setCodeTask] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [saving, setSaving] = useState(false);

  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | null>(null);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);

  // Por padrão o board esconde as concluídas antigas (só as 50 mais recentes);
  // este toggle pede todas.
  const [showAllDone, setShowAllDone] = useState(false);

  // Pausa o polling enquanto uma ação otimista está em voo (evita "pulo" visual).
  const busyRef = useRef(false);
  // Busca e "ver todas concluídas" correm no BACKEND. Os refs carregam o estado
  // atual para o polling não perdê-lo entre ciclos.
  const searchRef = useRef('');
  const allDoneRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!workspaceId || busyRef.current) return;
    const params = new URLSearchParams();
    const q = searchRef.current.trim();
    if (q) params.set('q', q);
    if (allDoneRef.current) params.set('allDone', 'true');
    const qs = params.toString();
    try {
      const ts = await api<Task[]>(`/workspaces/${workspaceId}/tasks${qs ? `?${qs}` : ''}`);
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

  // Busca com debounce: a cada mudança no termo, refaz o fetch (backend).
  useEffect(() => {
    searchRef.current = search;
    const id = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(id);
  }, [search, refresh]);

  // Alternar "ver todas concluídas" refaz o fetch imediatamente.
  useEffect(() => {
    allDoneRef.current = showAllDone;
    void refresh();
  }, [showAllDone, refresh]);

  // Tempo real: entra na sala do workspace e aplica mudanças assim que chegam
  // (o polling acima continua como rede de segurança caso o socket caia).
  useEffect(() => {
    if (!workspaceId) return;
    const socket = getSocket();

    // Entrar na sala precisa acontecer a CADA (re)conexão: se o socket cair e
    // reconectar (Wi-Fi, suspensão, deploy do backend), o servidor cria uma
    // sessão nova que não está em sala nenhuma. Sem reemitir o join no
    // 'connect', o tempo real pararia silenciosamente até um F5. Também
    // recarregamos as tasks: eventos perdidos durante a queda voltam de uma vez.
    const join = () => {
      socket.emit('workspace:join', workspaceId);
      void refresh();
    };
    if (socket.connected) join();
    socket.on('connect', join);

    const onCreated = (task: Task) =>
      setTasks((ts) => (ts.some((t) => t.id === task.id) ? ts : [task, ...ts]));
    const onUpdated = (task: Task) =>
      setTasks((ts) => (busyRef.current ? ts : ts.map((t) => (t.id === task.id ? task : t))));
    const onDeleted = ({ id: deletedId }: { id: string }) =>
      setTasks((ts) => ts.filter((t) => t.id !== deletedId));

    socket.on('task:created', onCreated);
    socket.on('task:updated', onUpdated);
    socket.on('task:deleted', onDeleted);
    return () => {
      socket.emit('workspace:leave', workspaceId);
      socket.off('connect', join);
      socket.off('task:created', onCreated);
      socket.off('task:updated', onUpdated);
      socket.off('task:deleted', onDeleted);
    };
  }, [workspaceId, refresh]);

  // Busca já foi aplicada no backend; aqui só os filtros de faceta (client-side).
  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (assigneeFilter && t.assigneeId !== assigneeFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (labelFilter && !(t.labels ?? []).some((l) => l.labelId === labelFilter)) return false;
      return true;
    });
  }, [tasks, assigneeFilter, priorityFilter, labelFilter]);

  // Atualiza o checklist de uma task no estado local (resposta imediata; o
  // backend re-emite via socket para os demais).
  function setChecklist(taskId: string, items: ChecklistItem[]) {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, checklist: items } : t)));
  }

  // Etiquetas para o filtro: as que estão EM USO nas tasks atuais (sem fetch extra).
  const availableLabels = useMemo(() => {
    const map = new Map<string, Label>();
    for (const t of tasks) for (const tl of t.labels ?? []) map.set(tl.label.id, tl.label);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const task = await api<Task>(`/workspaces/${workspaceId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title, description: description || undefined, priority }),
      });
      setTasks((prev) => [task, ...prev]);
      setShowForm(false);
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
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
    <div className="min-h-screen px-4 py-4 sm:px-6 sm:py-6">
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

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowMembers(true)} className="mr-1 hidden -space-x-2 sm:flex" title="Equipe">
            {members.slice(0, 4).map((m) => <Avatar key={m.id} user={m.user} size={8} />)}
            {members.length > 4 && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs">
                +{members.length - 4}
              </span>
            )}
          </button>
          <button onClick={() => setShowMembers(true)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500">
            Equipe
          </button>
          <button onClick={() => setShowLabels(true)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500">
            Etiquetas
          </button>
          <button onClick={() => setShowActivity(true)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500">
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
          placeholder="Buscar em título, descrição e comentários…"
          className="w-full sm:w-72 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-indigo-500"
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

        {/* Filtro por prioridade */}
        <div className="flex items-center gap-1">
          {PRIORITY_ORDER.map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter((cur) => (cur === p ? null : p))}
              title={`Prioridade ${PRIORITY_META[p].label}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition ${
                priorityFilter === p ? PRIORITY_META[p].chip : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[p].dot}`} />
              {PRIORITY_META[p].label}
            </button>
          ))}
        </div>

        {/* Filtro por etiqueta (só as em uso) */}
        {availableLabels.length > 0 && (
          <select
            value={labelFilter ?? ''}
            onChange={(e) => setLabelFilter(e.target.value || null)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500"
          >
            <option value="">Todas as etiquetas</option>
            {availableLabels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}

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
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Prioridade
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
              >
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </select>
            </label>
            <button
              disabled={saving}
              className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? 'Criando…' : 'Criar task'}
            </button>
          </div>
        </form>
      )}

      {/* ===== Colunas =====
          Mobile: rolagem horizontal com colunas de largura fixa (padrão kanban
          em telas pequenas). lg+: grid de 5 colunas que preenche a largura. */}
      <div className="flex gap-3 overflow-x-auto pb-3 lg:grid lg:grid-cols-5 lg:overflow-visible">
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
              className={`flex min-h-[60vh] w-72 shrink-0 flex-col rounded-xl bg-zinc-900/50 p-2.5 ring-1 ring-inset transition lg:w-auto ${
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
                        className="shrink-0 text-zinc-600 hover:text-zinc-200 sm:hidden sm:group-hover:block"
                      >
                        ✎
                      </button>
                    </div>

                    {/* Badges: prioridade, etiquetas, prazo, progresso do checklist */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span
                        title={`Prioridade ${PRIORITY_META[task.priority].label}`}
                        className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${PRIORITY_META[task.priority].chip}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[task.priority].dot}`} />
                        {PRIORITY_META[task.priority].label}
                      </span>
                      {(task.labels ?? []).map((tl) => (
                        <span
                          key={tl.labelId}
                          style={{ backgroundColor: tl.label.color, color: textOn(tl.label.color) }}
                          className="rounded-full px-1.5 py-0.5 font-medium"
                        >
                          {tl.label.name}
                        </span>
                      ))}
                      {task.dueDate && dueState(task.dueDate) !== 'none' && (
                        <span className={`rounded-full px-1.5 py-0.5 ${DUE_CLASS[dueState(task.dueDate) as 'overdue' | 'soon' | 'later']}`}>
                          🗓 {formatDue(task.dueDate)}
                        </span>
                      )}
                      {task.checklist && task.checklist.length > 0 && (
                        <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                          ✓ {task.checklist.filter((i) => i.done).length}/{task.checklist.length}
                        </span>
                      )}
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
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-xs text-zinc-500">
                            Coluna
                            <select
                              value={task.status}
                              onChange={(e) => void moveTask(task.id, e.target.value as TaskStatus)}
                              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                            >
                              {COLUMNS.map((c) => (
                                <option key={c.status} value={c.status}>{c.label}</option>
                              ))}
                            </select>
                          </label>
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
                        </div>
                        {workspaceId && (
                          <TaskChecklist
                            workspaceId={workspaceId}
                            taskId={task.id}
                            items={task.checklist ?? []}
                            onChange={(items) => setChecklist(task.id, items)}
                          />
                        )}
                        {workspaceId && (
                          <TaskComments workspaceId={workspaceId} taskId={task.id} members={members} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Coluna concluída: alternar entre "recentes" e "todas". Escondido
                  durante busca (a busca já traz tudo que casa). */}
              {col.status === 'DONE' && !search.trim() && (
                <button
                  onClick={() => setShowAllDone((v) => !v)}
                  className="mt-2 rounded-lg border border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                >
                  {showAllDone ? 'Mostrar só as recentes' : 'Mostrar todas as concluídas'}
                </button>
              )}
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
      {showLabels && workspaceId && (
        <LabelsPanel
          workspaceId={workspaceId}
          onChanged={() => void refresh()}
          onClose={() => setShowLabels(false)}
        />
      )}
    </div>
  );
}
