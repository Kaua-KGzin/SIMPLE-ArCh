import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/auth';

/**
 * Destino do redirect do backend após o OAuth: /auth/success?token=<jwt>.
 * Guardamos o token e mandamos o usuário para a lista de workspaces.
 */
export function AuthSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      auth.setToken(token);
      navigate('/', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [params, navigate]);

  return <div className="min-h-screen flex items-center justify-center text-soft-2">Entrando…</div>;
}
