import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, api } from '../lib/api';
import { auth } from '../lib/auth';

/**
 * Tela de login. Duas formas de entrar, independentes:
 *  - E-mail/senha: nossa conta local, sem depender do GitHub.
 *  - GitHub: redireciona pro fluxo OAuth (necessário só se quiser
 *    sincronizar tasks com Issues de um repositório).
 */
export function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body =
        mode === 'login' ? { email, password } : { email, password, name: name || undefined };
      const { accessToken } = await api<{ accessToken: string }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      auth.setToken(accessToken);
      navigate('/', { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex flex-col items-center">
          <img
            src="/icon-512.png"
            alt="SIMPLE ArCh"
            width={80}
            height={80}
            className="rounded-2xl shadow-2xl brand-glow"
          />
          <h1 className="mt-5 brand-text text-4xl font-bold tracking-tight">SIMPLE ArCh</h1>
          <p className="mt-2 text-zinc-400">
            Gerencie projetos em equipe, com ou sem GitHub.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 text-left">
          {error && <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>}

          {mode === 'register' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome (opcional)"
              maxLength={100}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            required
            maxLength={255}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            required
            minLength={mode === 'register' ? 8 : undefined}
            maxLength={72}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />

          <button
            disabled={busy}
            className="brand-gradient brand-gradient-hover brand-glow w-full rounded-lg px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
          >
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
          >
            {mode === 'login' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <div className="h-px flex-1 bg-zinc-800" />
          ou
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <a
          href={`${API_URL}/auth/github/login`}
          className="inline-flex items-center gap-3 rounded-lg bg-zinc-100 px-6 py-3 font-medium text-zinc-900 transition hover:bg-white"
        >
          <svg viewBox="0 0 16 16" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          Entrar com GitHub
        </a>
      </div>
    </div>
  );
}
