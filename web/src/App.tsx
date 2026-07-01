import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { auth } from './lib/auth';
import { Login } from './pages/Login';
import { AuthSuccess } from './pages/AuthSuccess';
import { Workspaces } from './pages/Workspaces';
import { Board } from './pages/Board';

/** Rotas privadas: sem token, volta pro login. */
function RequireAuth() {
  return auth.isLoggedIn() ? <Outlet /> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Destino do redirect do backend após o OAuth do GitHub */}
        <Route path="/auth/success" element={<AuthSuccess />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Workspaces />} />
          <Route path="/w/:workspaceId" element={<Board />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
