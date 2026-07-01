import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Activity {
  commits: { sha: string; message: string; author: string; avatarUrl: string | null; date: string; url: string }[];
  pulls: { number: number; title: string; state: string; author: string; avatarUrl: string; date: string; url: string }[];
}

const PR_DOT: Record<string, string> = {
  open: 'bg-green-500',
  merged: 'bg-purple-500',
  closed: 'bg-red-500',
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Feed de atividade do repositório: o pulso do projeto sem sair do board. */
export function ActivityPanel({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Activity>(`/workspaces/${workspaceId}/activity`)
      .then(setActivity)
      .catch((e) => setError(e.message));
  }, [workspaceId]);

  return (
    <aside className="fixed inset-y-0 right-0 z-10 w-96 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Atividade do repositório</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">✕</button>
      </div>

      {error && <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-300">{error}</p>}
      {!activity && !error && <p className="text-sm text-zinc-500">Carregando…</p>}

      {activity && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Pull Requests</h3>
          {activity.pulls.length === 0 && <p className="mb-4 text-sm text-zinc-600">Nenhum PR ainda.</p>}
          <ul className="mb-6 space-y-2">
            {activity.pulls.map((p) => (
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
            {activity.commits.map((c) => (
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
    </aside>
  );
}
