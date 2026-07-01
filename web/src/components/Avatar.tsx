import type { PublicUser } from '../types';

/** Avatar do GitHub com fallback para a inicial do login. */
export function Avatar({ user, size = 6 }: { user: PublicUser; size?: 5 | 6 | 8 }) {
  const cls = { 5: 'h-5 w-5', 6: 'h-6 w-6', 8: 'h-8 w-8' }[size];
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt={user.githubLogin}
      title={user.name ?? user.githubLogin}
      className={`${cls} rounded-full ring-1 ring-zinc-700`}
    />
  ) : (
    <span
      title={user.githubLogin}
      className={`${cls} flex items-center justify-center rounded-full bg-indigo-900 text-xs font-bold`}
    >
      {user.githubLogin[0]?.toUpperCase()}
    </span>
  );
}
