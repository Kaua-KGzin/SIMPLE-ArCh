import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirm';
import { AppBackground } from '../components/AppBackground';
import { Skeleton } from '../components/Skeleton';
import { IconNodes, IconHexagon } from '../components/icons';
import { textOn } from '../lib/task-meta';
import type { Workspace } from '../types';

const AVA_COLORS = ['#8b5cf6', '#3b82f6', '#c084fc', '#22c55e', '#06b6d4', '#f97316'];
const avaColor = (s: string) => AVA_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVA_COLORS.length];
const initial = (s: string) => (s.trim()[0] ?? '?').toUpperCase();

/** Lê o githubLogin do JWT (se houver) só para exibir no menu do usuário. */
function tokenLogin(): string | null {
  try {
    const t = auth.getToken();
    if (!t) return null;
    const payload = JSON.parse(atob(t.split('.')[1]));
    return payload.githubLogin ?? null;
  } catch {
    return null;
  }
}

/** Lista de workspaces do usuário + formulário de criação. */
export function Workspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [saving, setSaving] = useState(false);
  const login = tokenLogin();

  useEffect(() => {
    api<Workspace[]>('/workspaces')
      .then(setWorkspaces)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
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
      toast.success('Workspace criado.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function logoutAll() {
    setMenuOpen(false);
    const ok = await confirmDialog({
      title: 'Sair de todos os dispositivos?',
      message: 'As sessões nos outros dispositivos serão encerradas. Você seguirá conectado só aqui.',
      confirmLabel: 'Sair de tudo',
    });
    if (!ok) return;
    try {
      const { accessToken } = await api<{ accessToken: string }>('/auth/logout-all', { method: 'POST' });
      auth.setToken(accessToken);
      toast.success('Sessões encerradas nos outros dispositivos.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const field = 'w-full rounded-[10px] border border-line-input bg-base-2 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-violet';

  return (
    <div className="app-grid relative min-h-screen overflow-hidden">
      <AppBackground />
      <div className="relative z-10 mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/icon-192.png" width={32} height={32} alt="" className="rounded-lg brand-glow" />
            <span className="brand-text font-display text-lg font-bold tracking-tight">SIMPLE ArCh</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowForm((v) => !v)}
              className={
                showForm
                  ? 'rounded-[10px] border border-line-2 px-4 py-2 text-[13.5px] font-semibold text-soft transition hover:border-faint'
                  : 'btn-brand rounded-[10px] px-4 py-2 text-[13.5px]'
              }
            >
              {showForm ? 'Cancelar' : '+ Novo workspace'}
            </button>

            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-line-2 bg-panel font-display text-[13px] font-bold text-soft transition hover:border-faint"
              >
                {login ? initial(login) : '·'}
              </button>
              {menuOpen && (
                <div className="dialog-in absolute right-0 top-[46px] z-20 w-[230px] rounded-[14px] border border-line bg-panel p-2 shadow-2xl">
                  {login && <p className="mx-2.5 mb-2 mt-1.5 font-mono text-xs text-faint">@{login}</p>}
                  <button onClick={logoutAll} className="w-full rounded-lg px-2.5 py-2.5 text-left text-[13px] text-soft transition hover:bg-base-2">
                    Sair de todos os dispositivos
                  </button>
                  <button
                    onClick={() => { auth.clear(); window.location.href = '/login'; }}
                    className="w-full rounded-lg px-2.5 py-2.5 text-left text-[13px] text-red-300 transition hover:bg-base-2"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {error && (
          <p className="mb-5 rounded-[10px] border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</p>
        )}

        {showForm && (
          <form onSubmit={createWorkspace} className="dialog-in mb-7 flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do workspace (ex.: Equipe Backend)" required className={field} />
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Repositório GitHub (opcional): owner/repo" pattern="[\w.\-]+/[\w.\-]+" className={`${field} font-mono text-[13px]`} />
            <button disabled={saving} className="btn-brand self-start rounded-[10px] px-5 py-2.5 text-sm">
              {saving ? 'Criando…' : 'Criar workspace'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-[84px] w-full rounded-2xl" />
            <Skeleton className="h-[84px] w-full rounded-2xl" />
            <Skeleton className="h-[84px] w-full rounded-2xl" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-line-2 py-16 text-center">
            <div className="brand-gradient mx-auto mb-4 flex h-13 w-13 items-center justify-center rounded-2xl" style={{ width: 52, height: 52 }}>
              <IconHexagon size={22} className="text-white" />
            </div>
            <p className="text-[15px] text-soft">Nenhum workspace ainda.</p>
            <p className="mt-1 text-[13px] text-faint">Crie o primeiro para começar a organizar o time.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {workspaces.map((ws, i) => (
              <Link
                key={ws.id}
                to={`/w/${ws.id}`}
                style={{ '--i': i } as React.CSSProperties}
                className="fade-up block rounded-2xl border border-line bg-panel p-5 transition hover:-translate-y-0.5 hover:border-[#3a3748]"
              >
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="font-display text-[16.5px] font-semibold">{ws.name}</span>
                  {ws._count && (
                    <span className="whitespace-nowrap text-xs text-faint">{ws._count.tasks} tasks · {ws._count.members} membros</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  {ws.githubRepoFullName ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-soft-2">
                      <IconNodes size={12} className="text-brand-violet" /> {ws.githubRepoFullName}
                    </span>
                  ) : <span />}
                  {ws.members && ws.members.length > 0 && (
                    <div className="flex">
                      {ws.members.slice(0, 4).map((m) => {
                        const nm = m.user.name ?? m.user.githubLogin ?? 'membro';
                        return (
                          <span
                            key={m.id}
                            className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                            style={{ background: avaColor(nm), color: textOn(avaColor(nm)), borderColor: '#111118' }}
                          >
                            {initial(nm)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
