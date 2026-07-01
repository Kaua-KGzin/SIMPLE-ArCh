import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

interface PrCode {
  number: number;
  title: string;
  state: string; // 'open' | 'closed' | 'merged'
  branch: string;
  author: { login: string; avatarUrl: string };
  additions: number;
  deletions: number;
  changedFiles: number;
  url: string;
  files: PrFile[];
}

const STATE_BADGE: Record<string, string> = {
  open: 'bg-green-900 text-green-300',
  merged: 'bg-purple-900 text-purple-300',
  closed: 'bg-red-900 text-red-300',
};

/** Colore uma linha do diff unificado conforme o prefixo (+/-/@@). */
function diffLineClass(line: string): string {
  if (line.startsWith('+')) return 'bg-green-950/60 text-green-300';
  if (line.startsWith('-')) return 'bg-red-950/60 text-red-300';
  if (line.startsWith('@@')) return 'bg-indigo-950/60 text-indigo-300';
  return 'text-zinc-400';
}

/**
 * Modal "Código da task": mostra o PR vinculado (via webhook) com estatísticas
 * e o diff colorido por arquivo — a equipe revisa sem sair do board.
 */
export function CodeModal({
  workspaceId,
  taskId,
  onClose,
}: {
  workspaceId: string;
  taskId: string;
  onClose: () => void;
}) {
  const [code, setCode] = useState<PrCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);

  useEffect(() => {
    api<PrCode>(`/workspaces/${workspaceId}/tasks/${taskId}/code`)
      .then((c) => {
        setCode(c);
        if (c.files.length === 1) setOpenFile(c.files[0].filename);
      })
      .catch((e) => setError(e.message));
  }, [workspaceId, taskId]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">Código da task</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">✕</button>
        </div>

        {error && <p className="rounded-lg bg-amber-950 px-4 py-3 text-sm text-amber-300">{error}</p>}
        {!code && !error && <p className="text-zinc-500">Carregando diff do GitHub…</p>}

        {code && (
          <>
            {/* Cabeçalho do PR */}
            <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_BADGE[code.state] ?? ''}`}>
                  {code.state}
                </span>
                <a href={code.url} target="_blank" rel="noreferrer" className="font-medium hover:text-indigo-400">
                  PR #{code.number}: {code.title}
                </a>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <img src={code.author.avatarUrl} className="h-4 w-4 rounded-full" alt="" />
                  {code.author.login}
                </span>
                <span className="font-mono">⑂ {code.branch}</span>
                <span>{code.changedFiles} arquivo(s)</span>
                <span className="font-mono text-green-400">+{code.additions}</span>
                <span className="font-mono text-red-400">−{code.deletions}</span>
              </div>
            </div>

            {/* Arquivos e diffs */}
            <ul className="space-y-2">
              {code.files.map((f) => (
                <li key={f.filename} className="overflow-hidden rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setOpenFile((cur) => (cur === f.filename ? null : f.filename))}
                    className="flex w-full items-center justify-between bg-zinc-950 px-3 py-2 text-left text-sm hover:bg-zinc-800"
                  >
                    <span className="truncate font-mono text-xs">{f.filename}</span>
                    <span className="ml-3 shrink-0 font-mono text-xs">
                      <span className="text-green-400">+{f.additions}</span>{' '}
                      <span className="text-red-400">−{f.deletions}</span>
                    </span>
                  </button>
                  {openFile === f.filename && (
                    <pre className="overflow-x-auto bg-zinc-950/80 p-0 text-[11px] leading-5">
                      {f.patch
                        ? f.patch.split('\n').map((line, i) => (
                            <div key={i} className={`px-3 ${diffLineClass(line)}`}>
                              {line || ' '}
                            </div>
                          ))
                        : <div className="px-3 py-2 text-zinc-500">Sem diff disponível (binário ou arquivo muito grande).</div>}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
