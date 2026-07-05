import { useState } from 'react';
import { api } from '../lib/api';
import { confirmDialog } from '../lib/confirm';
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
    const ok = await confirmDialog({
      title: `Remover ${displayName(member.user)}?`,
      message: 'A pessoa perde o acesso a este workspace imediatamente.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await api(`/workspaces/${workspaceId}/members/${member.user.id}`, { method: 'DELETE' });
      onChange(members.filter((m) => m.id !== member.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <aside className="panel-in fixed inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Equipe ({members.length})</h2>
        <button onClick={onClose} className="text-faint transition hover:text-soft">✕</button>
      </div>

      {error && <p className="mb-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

      <form onSubmit={invite} className="mb-5 space-y-2">
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="E-mail ou login do GitHub"
          required
          className="w-full rounded-[10px] border border-line-input bg-base-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand-violet"
        />
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="flex-1 rounded-[10px] border border-line-input bg-base-2 px-2 py-2 text-sm text-ink-2"
          >
            <option value="MEMBER">Membro</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button disabled={saving} className="btn-brand rounded-[10px] px-4 py-2 text-sm">
            {saving ? '…' : 'Convidar'}
          </button>
        </div>
        <p className="text-xs text-faint-2">
          A pessoa precisa já ter conta na plataforma (e-mail/senha ou GitHub).
        </p>
      </form>

      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-base-2 px-3 py-2.5"
          >
            <Avatar user={m.user} size={8} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-2">{displayName(m.user)}</p>
              <p className="text-xs text-faint">
                {m.user.githubLogin ? `@${m.user.githubLogin} · ` : ''}{ROLE_LABEL[m.role]}
              </p>
            </div>
            {m.role !== 'OWNER' && (
              <button
                onClick={() => remove(m)}
                title="Remover do workspace"
                className="text-faint-3 transition hover:text-red-400"
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
