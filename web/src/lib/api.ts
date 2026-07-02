import { auth } from './auth';

// Em produção (Vercel) API e frontend vivem na MESMA origem ('' = relativo);
// em dev o Vite roda na 5173 e a API na 3000, daí o fallback com localhost.
export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : '');

/**
 * Wrapper de fetch: injeta o Bearer token e trata erros de forma uniforme.
 * 401 = token expirado/inválido -> derruba a sessão e volta pro login.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.getToken()}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    auth.clear();
    window.location.href = '/login';
    throw new Error('Sessão expirada.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
    throw new Error(msg ?? `Erro ${res.status}`);
  }

  // DELETE 204 não tem corpo.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
