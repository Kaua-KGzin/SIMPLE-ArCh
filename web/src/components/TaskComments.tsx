import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Avatar } from './Avatar';
import { displayName, type Comment, type Member } from '../types';

// Socket é primário (comment:created chega ao vivo); poll é só reconciliação.
const POLL_MS = 30_000;

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Renderiza o texto destacando @menções em indigo. */
function CommentBody({ body }: { body: string }) {
  const parts = body.split(/(@[\w.-]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words text-xs text-zinc-300">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="rounded bg-indigo-950 px-1 font-medium text-indigo-300">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

/**
 * Comentários de uma task — comunicação nativa da equipe, com @menções.
 * Clicar num membro insere a menção no texto.
 */
export function TaskComments({
  workspaceId,
  taskId,
  members,
}: {
  workspaceId: string;
  taskId: string;
  members: Member[];
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const base = `/workspaces/${workspaceId}/tasks/${taskId}/comments`;

  const load = useCallback(async () => {
    try {
      setComments(await api<Comment[]>(base));
    } catch {
      /* silencioso entre polls */
    }
  }, [base]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Comentários de colegas aparecem na hora (a task já está numa sala de
  // workspace via Board.tsx; aqui só filtramos pelo taskId certo).
  useEffect(() => {
    const socket = getSocket();
    const onCreated = (c: Comment) => {
      if (c.taskId !== taskId) return;
      setComments((cs) => (cs?.some((x) => x.id === c.id) ? cs : [...(cs ?? []), c]));
    };
    const onDeleted = ({ id, taskId: tId }: { id: string; taskId: string }) => {
      if (tId !== taskId) return;
      setComments((cs) => (cs ?? []).filter((c) => c.id !== id));
    };
    socket.on('comment:created', onCreated);
    socket.on('comment:deleted', onDeleted);
    return () => {
      socket.off('comment:created', onCreated);
      socket.off('comment:deleted', onDeleted);
    };
  }, [taskId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api<Comment>(base, {
        method: 'POST',
        body: JSON.stringify({ body: body.trim() }),
      });
      setComments((cs) => [...(cs ?? []), created]);
      setBody('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: string) {
    try {
      await api(`${base}/${commentId}`, { method: 'DELETE' });
      setComments((cs) => (cs ?? []).filter((c) => c.id !== commentId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function mention(member: Member) {
    const tag = `@${(member.user.name ?? member.user.githubLogin ?? 'membro').replace(/\s+/g, '')} `;
    setBody((b) => (b.endsWith(' ') || b === '' ? b + tag : `${b} ${tag}`));
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Comentários {comments ? `(${comments.length})` : ''}
      </p>

      {error && <p className="rounded bg-red-950 px-2 py-1 text-xs text-red-300">{error}</p>}

      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {comments === null && <p className="text-xs text-zinc-600">Carregando…</p>}
        {comments?.length === 0 && (
          <p className="text-xs text-zinc-600">Nenhum comentário ainda. Comece a conversa!</p>
        )}
        {comments?.map((c) => (
          <div key={c.id} className="group/comment rounded-lg bg-zinc-900 p-2">
            <div className="mb-1 flex items-center gap-2">
              <Avatar user={c.author} size={5} />
              <span className="text-xs font-medium text-zinc-300">{displayName(c.author)}</span>
              <span className="text-[10px] text-zinc-600">{timeAgo(c.createdAt)}</span>
              <button
                onClick={() => void remove(c.id)}
                title="Apagar comentário"
                className="ml-auto hidden text-zinc-600 hover:text-red-400 group-hover/comment:block"
              >
                ✕
              </button>
            </div>
            <CommentBody body={c.body} />
          </div>
        ))}
      </div>

      <form onSubmit={send} className="space-y-1.5">
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(e);
            }
          }}
          placeholder="Comentar… (@ para mencionar, Enter envia)"
          rows={2}
          maxLength={2000}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
        />
        <div className="flex items-center gap-1">
          {members.slice(0, 6).map((m) => (
            <button
              key={m.user.id}
              type="button"
              onClick={() => mention(m)}
              title={`Mencionar ${displayName(m.user)}`}
              className="opacity-60 transition hover:opacity-100"
            >
              <Avatar user={m.user} size={5} />
            </button>
          ))}
          <button
            disabled={busy || !body.trim()}
            className="ml-auto rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium hover:bg-indigo-500 disabled:opacity-40"
          >
            {busy ? '…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}
