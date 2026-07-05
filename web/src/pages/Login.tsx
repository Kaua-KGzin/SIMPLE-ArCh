import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, api } from '../lib/api';
import { auth } from '../lib/auth';
import { AppBackground } from '../components/AppBackground';
import { IconZap, IconNodes, IconCalendar, IconGithub, IconSpinner } from '../components/icons';

/**
 * Login em duas colunas: painel de marca (esquerda) + formulário (direita).
 * Duas formas de entrar, independentes — e-mail/senha ou GitHub OAuth.
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
      setBusy(false);
    }
  }

  const tab = (active: boolean) =>
    `flex-1 rounded-[10px] py-2.5 text-sm font-bold transition ${
      active ? 'bg-[#1a1a24] text-ink' : 'text-faint hover:text-soft'
    }`;
  const field =
    'w-full rounded-[10px] border border-line-input bg-base-2 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-violet';

  return (
    <div className="relative flex min-h-screen flex-wrap overflow-hidden">
      <AppBackground />

      {/* ===== Painel de marca ===== */}
      <div className="relative z-10 flex min-w-[340px] flex-1 flex-col justify-between gap-12 border-r border-[#1a1a22] p-8 sm:p-14">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" width={36} height={36} alt="" className="rounded-[9px] brand-glow" />
          <span className="brand-text font-display text-xl font-bold tracking-tight">SIMPLE ArCh</span>
        </div>

        <div className="max-w-[460px]">
          <p className="mb-4 font-mono text-xs uppercase tracking-[.14em] text-brand-violet">Board · Issues · Tempo real</p>
          <h1 className="mb-5 font-display text-[clamp(2rem,5vw,2.9rem)] font-semibold leading-[1.08] tracking-tight text-ink text-balance">
            Onde o board encontra o commit.
          </h1>
          <p className="mb-9 text-base leading-relaxed text-soft-2">
            Tasks e Issues do GitHub sincronizam nos dois sentidos. PRs movem o trabalho sozinhos.
            Tudo em tempo real — com ou sem GitHub conectado.
          </p>
          <ul className="flex flex-col gap-4">
            {[
              { icon: <IconZap size={16} className="text-brand-violet" />, text: 'Board, comentários e notificações atualizam ao vivo' },
              { icon: <IconNodes size={16} className="text-brand-blue" />, text: 'Criar uma task abre a Issue; mergear conclui a task' },
              { icon: <IconCalendar size={16} className="text-brand-magenta" />, text: 'Funciona 100% sem GitHub — a integração é opcional' },
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-3.5">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-line-2 bg-[#141420]">
                  {f.icon}
                </span>
                <span className="text-sm text-soft">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-[11px] text-faint-3">&lt;/&gt; simple-arch · dev collaboration</p>
      </div>

      {/* ===== Painel do formulário ===== */}
      <div className="relative z-10 flex min-w-[320px] flex-1 items-center justify-center p-6 sm:p-12">
        <div className="dialog-in w-full max-w-[380px] rounded-[20px] border border-line bg-panel p-3.5 shadow-2xl">
          <div className="mb-5 flex gap-1 rounded-[14px] bg-base-2 p-1">
            <button onClick={() => { setMode('login'); setError(null); }} className={tab(mode === 'login')}>Entrar</button>
            <button onClick={() => { setMode('register'); setError(null); }} className={tab(mode === 'register')}>Criar conta</button>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-2.5 px-4 pb-5">
            {error && (
              <p className="rounded-[10px] border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">{error}</p>
            )}
            {mode === 'register' && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (opcional)" maxLength={100} className={field} />
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required maxLength={255} className={field} />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha" required minLength={mode === 'register' ? 8 : undefined} maxLength={72}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={field}
            />

            <button disabled={busy} className="btn-brand mt-1 flex items-center justify-center gap-2 rounded-[10px] py-3 text-sm">
              {busy && <IconSpinner size={15} className="spin" />}
              {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>

            <div className="my-3 flex items-center gap-3 text-[11px] text-faint-3">
              <span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" />
            </div>

            <a
              href={`${API_URL}/auth/github/login`}
              className="flex items-center justify-center gap-2.5 rounded-[10px] border border-line-input bg-base-2 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-faint"
            >
              <IconGithub size={17} /> Entrar com GitHub
            </a>
          </form>
        </div>
      </div>
    </div>
  );
}
