import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
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
        <h1 className="text-2xl font-bold">Meus Workspaces</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
          >
            {showForm ? 'Cancelar' : '+ Novo workspace'}
          </button>
          <button
            onClick={async () => {
              if (!confirm('Encerrar a sessão em TODOS os dispositivos? Você seguirá conectado só aqui.')) return;
              try {
                const { accessToken } = await api<{ accessToken: string }>('/auth/logout-all', { method: 'POST' });
                auth.setToken(accessToken); // mantém ESTA sessão válida com a nova versão
                alert('Sessões encerradas nos outros dispositivos.');
              } catch (e) {
                setError((e as Error).message);
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
        <p className="text-zinc-500">Carregando…</p>
      ) : workspaces.length === 0 ? (
        <p className="text-zinc-500">Nenhum workspace ainda. Crie o primeiro!</p>
      ) : (
        <ul className="space-y-3">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Link
                to={`/w/${ws.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600"
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
