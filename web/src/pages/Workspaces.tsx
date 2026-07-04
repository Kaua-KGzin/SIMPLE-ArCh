import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirm';
import { Logo } from '../components/Logo';
import { Skeleton } from '../components/Skeleton';
import type { Workspace } from '../types';

/** Lista de workspaces do usuário + formulário de criação. */
export function Workspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulário
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Workspace[]>('/workspaces')
      .then(setWorkspaces)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const ws = await api<Workspace>('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name, repoFullName: repo || undefined }),
      });
      setWorkspaces((prev) => [ws, ...prev]);
      setShowForm(false);
      setName('');
      setRepo('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Logo size={30} />
        <div className="flex gap-3">
          <button
            onClick={() => setShowForm((v) => !v)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              showForm
                ? 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                : 'brand-gradient brand-gradient-hover brand-glow text-white'
            }`}
          >
            {showForm ? 'Cancelar' : '+ Novo workspace'}
          </button>
          <button
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Sair de todos os dispositivos?',
                message: 'As sessões nos outros dispositivos serão encerradas. Você seguirá conectado só aqui.',
                confirmLabel: 'Sair de tudo',
              });
              if (!ok) return;
              try {
                const { accessToken } = await api<{ accessToken: string }>('/auth/logout-all', { method: 'POST' });
                auth.setToken(accessToken); // mantém ESTA sessão válida com a nova versão
                toast.success('Sessões encerradas nos outros dispositivos.');
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100"
            title="Invalida os tokens em todos os dispositivos"
          >
            Sair de tudo
          </button>
          <button
            onClick={() => { auth.clear(); window.location.href = '/login'; }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100"
          >
            Sair
          </button>
        </div>
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-950 px-4 py-2 text-sm text-red-300">{error}</p>}

      {showForm && (
        <form onSubmit={createWorkspace} className="mb-8 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do workspace (ex.: Equipe Backend)"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="Repositório GitHub (opcional): owner/repo"
            pattern="[\w.\-]+/[\w.\-]+"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Criando…' : 'Criar workspace'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-[76px] w-full rounded-xl" />
          <Skeleton className="h-[76px] w-full rounded-xl" />
          <Skeleton className="h-[76px] w-full rounded-xl" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient text-2xl">✦</div>
          <p className="text-zinc-400">Nenhum workspace ainda.</p>
          <p className="mt-1 text-sm text-zinc-600">Crie o primeiro para começar a organizar o time.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {workspaces.map((ws, i) => (
            <li key={ws.id} className="card-in" style={{ '--i': i } as React.CSSProperties}>
              <Link
                to={`/w/${ws.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:-translate-y-0.5 hover:border-zinc-600 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{ws.name}</span>
                  {ws._count && (
                    <span className="text-xs text-zinc-500">
                      {ws._count.tasks} tasks · {ws._count.members} membros
                    </span>
                  )}
                </div>
                {ws.githubRepoFullName && (
                  <p className="mt-1 text-sm text-zinc-500">⑂ {ws.githubRepoFullName}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
