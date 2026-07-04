import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Avatar } from './Avatar';
import { displayName, type ActivityEvent, type ActivityType } from '../types';

interface GithubActivity {
  commits: { sha: string; message: string; author: string; avatarUrl: string | null; date: string; url: string }[];
  pulls: { number: number; title: string; state: string; author: string; avatarUrl: string; date: string; url: string }[];
}

const PR_DOT: Record<string, string> = {
  open: 'bg-green-500',
  merged: 'bg-purple-500',
  closed: 'bg-red-500',
};

const EVENT_ICON: Record<ActivityType, string> = {
  TASK_CREATED: '＋',
  TASK_MOVED: '→',
  TASK_ASSIGNED: '👤',
  TASK_DELETED: '🗑',
  COMMENT_ADDED: '💬',
  MEMBER_JOINED: '🤝',
  PR_LINKED: '⑂',
};

const FEED_POLL_MS = 10_000;

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * Painel de atividade em duas abas:
 *  - Equipe: feed NATIVO da plataforma (tasks, comentários, membros) —
 *    funciona para qualquer workspace, com ou sem GitHub. Com polling.
 *  - GitHub: commits/PRs do repositório (só aparece se houver repo vinculado).
 */
export function ActivityPanel({
  workspaceId,
  hasRepo,
  onClose,
}: {
  workspaceId: string;
  hasRepo: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'team' | 'github'>('team');
  const [feed, setFeed] = useState<ActivityEvent[] | null>(null);
  const [github, setGithub] = useState<GithubActivity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      setFeed(await api<ActivityEvent[]>(`/workspaces/${workspaceId}/feed`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadFeed();
    const id = setInterval(() => void loadFeed(), FEED_POLL_MS);
    return () => clearInterval(id);
  }, [loadFeed]);

  useEffect(() => {
    const socket = getSocket();
    const onNew = (ev: ActivityEvent) =>
      setFeed((prev) => (prev?.some((e) => e.id === ev.id) ? prev : [ev, ...(prev ?? [])]));
    socket.on('activity:new', onNew);
    return () => {
      socket.off('activity:new', onNew);
    };
  }, []);

  useEffect(() => {
    if (tab !== 'github' || github || !hasRepo) return;
    api<GithubActivity>(`/workspaces/${workspaceId}/activity`)
      .then(setGithub)
      .catch((e) => setError(e.message));
  }, [tab, github, hasRepo, workspaceId]);

  return (
    <aside className="fixed inset-y-0 right-0 z-10 w-96 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Atividade</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">✕</button>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-950 p-1 text-sm">
        <button
          onClick={() => setTab('team')}
          className={`flex-1 rounded-md px-3 py-1.5 transition ${
            tab === 'team' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Equipe
        </button>
        {hasRepo && (
          <button
            onClick={() => setTab('github')}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              tab === 'github' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            GitHub
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 cursor-pointer rounded-lg bg-red-950 px-3 py-2 text-xs text-red-300" onClick={() => setError(null)}>
          {error}
        </p>
      )}

      {tab === 'team' && (
        <>
          {feed === null && <p className="text-sm text-zinc-500">Carregando…</p>}
          {feed?.length === 0 && (
            <p className="text-sm text-zinc-600">Nada por aqui ainda — crie uma task ou comente em alguma.</p>
          )}
          <ul className="space-y-2">
            {feed?.map((ev) => (
              <li
                key={ev.id}
                className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <span className="mt-0.5 w-5 shrink-0 text-center text-xs" aria-hidden>
                  {EVENT_ICON[ev.type] ?? '•'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs leading-relaxed text-zinc-300">
                    {ev.actor ? (
                      <span className="font-medium text-zinc-100">{displayName(ev.actor)} </span>
                    ) : null}
                    {ev.summary}
                  </span>
                  <span className="text-[10px] text-zinc-600">{timeAgo(ev.createdAt)}</span>
                </span>
                {ev.actor && <Avatar user={ev.actor} size={5} />}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'github' && (
        <>
          {!github && !error && <p className="text-sm text-zinc-500">Carregando…</p>}
          {github && (
            <>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Pull Requests</h3>
              {github.pulls.length === 0 && <p className="mb-4 text-sm text-zinc-600">Nenhum PR ainda.</p>}
              <ul className="mb-6 space-y-2">
                {github.pulls.map((p) => (
                  <li key={p.number}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm hover:border-zinc-600"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PR_DOT[p.state] ?? 'bg-zinc-500'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">#{p.number} {p.title}</span>
                        <span className="text-xs text-zinc-500">{p.author} · {timeAgo(p.date)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>

              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Commits</h3>
              <ul className="space-y-2">
                {github.commits.map((c) => (
                  <li key={c.sha}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm hover:border-zinc-600"
                    >
                      {c.avatarUrl && <img src={c.avatarUrl} className="mt-0.5 h-5 w-5 rounded-full" alt="" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{c.message}</span>
                        <span className="font-mono text-xs text-zinc-500">{c.sha}</span>
                        <span className="text-xs text-zinc-500"> · {c.author} · {timeAgo(c.date)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </aside>
  );
}
