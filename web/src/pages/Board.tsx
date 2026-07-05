import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { toast } from '../lib/toast';
import { withViewTransition } from '../lib/view-transition';
import { Avatar } from '../components/Avatar';
import { TaskCardSkeleton } from '../components/Skeleton';
import { MembersPanel } from '../components/MembersPanel';
import { LabelsPanel } from '../components/LabelsPanel';
import { ActivityPanel } from '../components/ActivityPanel';
import { CodeModal } from '../components/CodeModal';
import { TaskEditModal } from '../components/TaskEditModal';
import { TaskComments } from '../components/TaskComments';
import { TaskChecklist } from '../components/TaskChecklist';
import {
  IconChevronLeft, IconNodes, IconUsers, IconTag, IconActivity, IconSearch, IconPencil,
} from '../components/icons';
import {
  PRIORITY_META, PRIORITY_ORDER, COLUMN_META, DUE_STYLE, dueState, formatDue, textOn,
} from '../lib/task-meta';
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

const POLL_MS = 30_000;

/** Chip de prioridade (mesmo visual no filtro e no card). */
function PriorityChip({ p, active = true }: { p: TaskPriority; active?: boolean }) {
  const m = PRIORITY_META[p];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold"
      style={active
        ? { borderColor: m.border, background: m.bg, color: m.color }
        : { borderColor: '#232330', color: '#66647a' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? m.color : '#66647a' }} />
      {m.label}
    </span>
  );
}

export function Board() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | null>(null);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);

  const busyRef = useRef(false);
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
    } finally {
      setLoaded(true);
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

  useEffect(() => {
    searchRef.current = search;
    const id = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(id);
  }, [search, refresh]);

  useEffect(() => {
    allDoneRef.current = showAllDone;
    void refresh();
  }, [showAllDone, refresh]);

  useEffect(() => {
    if (!workspaceId) return;
    const socket = getSocket();
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

  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (assigneeFilter && t.assigneeId !== assigneeFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (labelFilter && !(t.labels ?? []).some((l) => l.labelId === labelFilter)) return false;
      return true;
    });
  }, [tasks, assigneeFilter, priorityFilter, labelFilter]);

  function setChecklist(taskId: string, items: ChecklistItem[]) {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, checklist: items } : t)));
  }

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
    if (prev.find((t) => t.id === taskId)?.status === status) return;
    busyRef.current = true;
    withViewTransition(() =>
      setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status } : t))),
    );
    try {
      await api(`/workspaces/${workspaceId}/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      setTasks(prev);
      toast.error((e as Error).message);
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
      toast.error((e as Error).message);
    }
  }

  const headerBtn = 'flex items-center gap-1.5 rounded-[10px] border border-line-2 bg-panel px-3.5 py-2 text-[13px] font-semibold text-soft transition hover:border-faint';
  const field = 'w-full rounded-[10px] border border-line-input bg-base-2 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand-violet';

  return (
    <div className="min-h-screen px-5 py-5 sm:px-7">
      {/* ===== Header ===== */}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/" className="mb-1.5 inline-flex items-center gap-1.5 text-xs text-faint transition hover:text-soft">
            <IconChevronLeft size={12} /> Workspaces
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[25px] font-semibold tracking-tight">{workspace?.name ?? '…'}</h1>
            {workspace?.githubRepoFullName && (
              <a
                href={`https://github.com/${workspace.githubRepoFullName}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-panel px-3 py-1 font-mono text-[11.5px] text-soft-2 transition hover:border-faint"
              >
                <IconNodes size={12} className="text-brand-violet" /> {workspace.githubRepoFullName}
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowMembers(true)} className="mr-0.5 hidden sm:flex" title="Equipe">
            {members.slice(0, 4).map((m, i) => (
              <span key={m.id} className="-ml-2 first:ml-0" style={{ zIndex: 4 - i }}><Avatar user={m.user} size={8} /></span>
            ))}
          </button>
          <button onClick={() => setShowMembers(true)} className={headerBtn}><IconUsers size={14} /> Equipe</button>
          <button onClick={() => setShowLabels(true)} className={headerBtn}><IconTag size={14} /> Etiquetas</button>
          <button onClick={() => setShowActivity(true)} className={headerBtn}><IconActivity size={14} /> Atividade</button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className={showForm
              ? 'rounded-[10px] border border-line-2 px-4 py-2 text-[13px] font-semibold text-soft transition hover:border-faint'
              : 'btn-brand rounded-[10px] px-4 py-2 text-[13px]'}
          >
            {showForm ? 'Cancelar' : '+ Nova task'}
          </button>
        </div>
      </header>

      {/* ===== Filtros ===== */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-column p-3">
        <div className="relative min-w-[200px] flex-[1_1_240px]">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint-2" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar em título, descrição e comentários…"
            className="w-full rounded-[10px] border border-line-2 bg-base-2 py-2.5 pl-8 pr-3 text-[13px] text-ink outline-none transition focus:border-brand-violet"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {members.map((m) => (
            <button
              key={m.user.id}
              onClick={() => setAssigneeFilter((cur) => (cur === m.user.id ? null : m.user.id))}
              title={`Filtrar por ${displayName(m.user)}`}
              className={`rounded-full transition ${assigneeFilter === m.user.id ? 'ring-2 ring-brand-violet' : 'opacity-60 hover:opacity-100'}`}
            >
              <Avatar user={m.user} size={6} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {PRIORITY_ORDER.map((p) => (
            <button key={p} onClick={() => setPriorityFilter((cur) => (cur === p ? null : p))} title={`Prioridade ${PRIORITY_META[p].label}`} className="cursor-pointer">
              <PriorityChip p={p} active={priorityFilter === p} />
            </button>
          ))}
        </div>

        {availableLabels.length > 0 && (
          <select
            value={labelFilter ?? ''} onChange={(e) => setLabelFilter(e.target.value || null)}
            className="rounded-[10px] border border-line-2 bg-base-2 px-2.5 py-2 text-xs text-soft outline-none focus:border-brand-violet"
          >
            <option value="">Todas as etiquetas</option>
            {availableLabels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}

        <span className="ml-auto flex items-center gap-2 text-[11.5px] text-faint">
          <span className="pulse-dot h-[7px] w-[7px] rounded-full bg-green-500" />
          {workspace?.githubRepoFullName ? 'sincronizando com o GitHub' : 'atualização automática'}
        </span>
      </div>

      {error && (
        <p className="mb-4 cursor-pointer rounded-[10px] border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm text-red-300" onClick={() => setError(null)}>
          {error}
        </p>
      )}

      {/* ===== Form nova task ===== */}
      {showForm && (
        <form onSubmit={createTask} className="dialog-in mb-4 flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4.5" style={{ padding: 18 }}>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={workspace?.githubRepoFullName ? 'Título da task (vira o título da Issue no GitHub)' : 'Título da task'}
            required maxLength={200} autoFocus className={field}
          />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" rows={2} className={`${field} resize-y`} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-soft-2">
              Prioridade
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="rounded-lg border border-line-input bg-base-2 px-2.5 py-1.5 text-sm text-ink">
                {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </label>
            <button disabled={saving} className="btn-brand ml-auto rounded-[10px] px-5 py-2 text-[13.5px]">
              {saving ? 'Criando…' : 'Criar task'}
            </button>
          </div>
        </form>
      )}

      {/* ===== Colunas ===== */}
      <div className="flex gap-3.5 overflow-x-auto pb-3">
        {COLUMN_META.map((col) => {
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
              className={`flex min-h-[64vh] flex-[0_0_272px] flex-col rounded-2xl border bg-column p-3 transition lg:flex-1 lg:min-w-0 ${
                dragOver === col.status ? 'border-brand-violet' : 'border-line'
              }`}
            >
              <h2 className="mx-1 mb-3 mt-0.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[.06em] text-soft-2">
                <span className="h-2 w-2 rounded-full" style={{ background: col.dot }} />
                {col.label}
                <span className="ml-auto rounded-full bg-raised px-2 py-0.5 text-[10px] text-soft-2">{colTasks.length}</span>
              </h2>

              <div className="flex flex-1 flex-col gap-2">
                {!loaded && (<><TaskCardSkeleton /><TaskCardSkeleton /></>)}
                {loaded && colTasks.length === 0 && (
                  <p className="pt-6 text-center text-[11.5px] text-faint-3">Nada por aqui</p>
                )}
                {colTasks.map((task, i) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('taskId', task.id); setDraggingId(task.id); }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => setOpenTask((cur) => (cur === task.id ? null : task.id))}
                    style={{ viewTransitionName: `task-${task.id}`, '--i': i } as React.CSSProperties}
                    className={`group card-in cursor-grab rounded-xl border border-line bg-panel p-3 transition hover:border-[#34313f] active:cursor-grabbing ${
                      draggingId === task.id ? 'scale-[0.98] opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-semibold leading-[1.4] text-ink">{task.title}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditTask(task); }}
                        title="Editar task"
                        className="shrink-0 text-faint-3 transition hover:text-soft"
                      >
                        <IconPencil size={13} />
                      </button>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <PriorityChip p={task.priority} />
                      {(task.labels ?? []).map((tl) => (
                        <span key={tl.labelId} className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: tl.label.color, color: textOn(tl.label.color) }}>
                          {tl.label.name}
                        </span>
                      ))}
                      {task.dueDate && dueState(task.dueDate) !== 'none' && (() => {
                        const s = DUE_STYLE[dueState(task.dueDate) as 'overdue' | 'soon' | 'later'];
                        return <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: s.bg, color: s.color }}>🗓 {formatDue(task.dueDate)}</span>;
                      })()}
                      {task.checklist && task.checklist.length > 0 && (
                        <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] font-semibold text-soft-2">
                          ✓ {task.checklist.filter((i) => i.done).length}/{task.checklist.length}
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center gap-3">
                      {task.githubIssueNumber != null && workspace?.githubRepoFullName && (
                        <a
                          href={`https://github.com/${workspace.githubRepoFullName}/issues/${task.githubIssueNumber}`}
                          target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[11px] text-faint transition hover:text-brand-violet"
                        >
                          #{task.githubIssueNumber}
                        </a>
                      )}
                      {task.githubPrNumber != null && (
                        <button onClick={(e) => { e.stopPropagation(); setCodeTask(task.id); }} title={`Ver diff do PR #${task.githubPrNumber}`} className="font-mono text-[11px] text-faint transition hover:text-green-400">
                          {'</>'} PR #{task.githubPrNumber}
                        </button>
                      )}
                      {task.assignee && <span className="ml-auto"><Avatar user={task.assignee} size={5} /></span>}
                    </div>

                    {openTask === task.id && (
                      <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
                        {task.description && <p className="whitespace-pre-wrap text-xs leading-relaxed text-soft-2">{task.description}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10.5px] text-faint">
                            Coluna
                            <select value={task.status} onChange={(e) => void moveTask(task.id, e.target.value as TaskStatus)} className="mt-1 block w-full rounded-lg border border-line-input bg-base-2 px-2 py-1.5 text-[11.5px] text-ink-2">
                              {COLUMN_META.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
                            </select>
                          </label>
                          <label className="text-[10.5px] text-faint">
                            Responsável
                            <select value={task.assigneeId ?? ''} onChange={(e) => void assignTask(task.id, e.target.value || null)} className="mt-1 block w-full rounded-lg border border-line-input bg-base-2 px-2 py-1.5 text-[11.5px] text-ink-2">
                              <option value="">— ninguém —</option>
                              {members.map((m) => <option key={m.user.id} value={m.user.id}>{displayName(m.user)}</option>)}
                            </select>
                          </label>
                        </div>
                        {workspaceId && (
                          <TaskChecklist workspaceId={workspaceId} taskId={task.id} items={task.checklist ?? []} onChange={(items) => setChecklist(task.id, items)} />
                        )}
                        {workspaceId && <TaskComments workspaceId={workspaceId} taskId={task.id} members={members} />}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {col.status === 'DONE' && !search.trim() && (
                <button onClick={() => setShowAllDone((v) => !v)} className="mt-2 rounded-[9px] border border-line px-2 py-1.5 text-[11px] text-faint transition hover:border-faint hover:text-soft">
                  {showAllDone ? 'Mostrar só as recentes' : 'Mostrar todas as concluídas'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== Painéis e modais ===== */}
      {showActivity && workspaceId && (
        <ActivityPanel workspaceId={workspaceId} hasRepo={!!workspace?.githubRepoFullName} onClose={() => setShowActivity(false)} />
      )}
      {codeTask && workspaceId && (
        <CodeModal workspaceId={workspaceId} taskId={codeTask} onClose={() => setCodeTask(null)} />
      )}
      {editTask && workspaceId && (
        <TaskEditModal
          workspaceId={workspaceId} task={editTask}
          onSaved={(t) => setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)))}
          onDeleted={(id) => setTasks((ts) => ts.filter((x) => x.id !== id))}
          onClose={() => setEditTask(null)}
        />
      )}
      {showMembers && workspaceId && (
        <MembersPanel workspaceId={workspaceId} members={members} onChange={setMembers} onClose={() => setShowMembers(false)} />
      )}
      {showLabels && workspaceId && (
        <LabelsPanel workspaceId={workspaceId} onChanged={() => void refresh()} onClose={() => setShowLabels(false)} />
      )}
    </div>
  );
}
