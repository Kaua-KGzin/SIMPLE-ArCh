import { useState } from 'react';
import { api } from '../lib/api';
import { Avatar } from './Avatar';
import { displayName, type Member, type MemberRole } from '../types';

const ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: 'Dono',
  ADMIN: 'Admin',
  MEMBER: 'Membro',
};

/**
 * Painel lateral de equipe: lista membros, convida por e-mail OU login do
 * GitHub (a pessoa precisa já ter conta na plataforma) e remove membros.
 */
export function MembersPanel({
  workspaceId,
  members,
  onChange,
  onClose,
}: {
  workspaceId: string;
  members: Member[];
  onChange: (members: Member[]) => void;
  onClose: () => void;
}) {
  const [login, setLogin] = useState('');
  const [role, setRole] = useState<MemberRole>('MEMBER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const member = await api<Member>(`/workspaces/${workspaceId}/members`, {
        method: 'POST',
        body: JSON.stringify({ identifier: login, role }),
      });
      onChange([...members, member]);
      setLogin('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(member: Member) {
    if (!confirm(`Remover ${displayName(member.user)} do workspace?`)) return;
    setError(null);
    try {
      await api(`/workspaces/${workspaceId}/members/${member.user.id}`, { method: 'DELETE' });
      onChange(members.filter((m) => m.id !== member.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-10 w-full max-w-sm overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Equipe ({members.length})</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">✕</button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-950 px-3 py-2 text-xs text-red-300">{error}</p>}

      <form onSubmit={invite} className="mb-5 space-y-2">
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="E-mail ou login do GitHub"
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm"
          >
            <option value="MEMBER">Membro</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? '…' : 'Convidar'}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          A pessoa precisa já ter conta na plataforma (e-mail/senha ou GitHub).
        </p>
      </form>

      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
          >
            <Avatar user={m.user} size={8} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName(m.user)}</p>
              <p className="text-xs text-zinc-500">
                {m.user.githubLogin ? `@${m.user.githubLogin} · ` : ''}{ROLE_LABEL[m.role]}
              </p>
            </div>
            {m.role !== 'OWNER' && (
              <button
                onClick={() => remove(m)}
                title="Remover do workspace"
                className="text-zinc-600 hover:text-red-400"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
