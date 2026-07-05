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
  if (line.startsWith('@@')) return 'bg-brand-violet/15 text-brand-violet';
  return 'text-soft-2';
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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(4,4,7,.75)] p-6" onClick={onClose}>
      <div
        className="dialog-in max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-[18px] border border-line-2 bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-[17px] font-semibold">Código da task</h2>
          <button onClick={onClose} className="text-faint transition hover:text-soft">✕</button>
        </div>

        {error && <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{error}</p>}
        {!code && !error && <p className="text-faint">Carregando diff do GitHub…</p>}

        {code && (
          <>
            {/* Cabeçalho do PR */}
            <div className="mb-4 rounded-[13px] border border-line bg-base-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATE_BADGE[code.state] ?? ''}`}>
                  {code.state}
                </span>
                <a href={code.url} target="_blank" rel="noreferrer" className="font-semibold text-ink-2 hover:text-brand-violet">
                  PR #{code.number}: {code.title}
                </a>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[11.5px] text-soft-2">
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
                <li key={f.filename} className="overflow-hidden rounded-[11px] border border-line">
                  <button
                    onClick={() => setOpenFile((cur) => (cur === f.filename ? null : f.filename))}
                    className="flex w-full items-center justify-between bg-base-2 px-3 py-2.5 text-left text-sm transition hover:brightness-125"
                  >
                    <span className="truncate font-mono text-[11.5px] text-soft">{f.filename}</span>
                    <span className="ml-3 shrink-0 font-mono text-[11px]">
                      <span className="text-green-400">+{f.additions}</span>{' '}
                      <span className="text-red-400">−{f.deletions}</span>
                    </span>
                  </button>
                  {openFile === f.filename && (
                    <pre className="overflow-x-auto bg-base p-0 text-[11px] leading-5">
                      {f.patch
                        ? f.patch.split('\n').map((line, i) => (
                            <div key={i} className={`px-3 ${diffLineClass(line)}`}>
                              {line || ' '}
                            </div>
                          ))
                        : <div className="px-3 py-2 text-faint">Sem diff disponível (binário ou arquivo muito grande).</div>}
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
