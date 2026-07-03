import { displayName, type PublicUser } from '../types';

/** Avatar com fallback para a inicial do nome (funciona com ou sem GitHub). */
export function Avatar({ user, size = 6 }: { user: PublicUser; size?: 5 | 6 | 8 }) {
  const cls = { 5: 'h-5 w-5', 6: 'h-6 w-6', 8: 'h-8 w-8' }[size];
  const label = displayName(user);
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt={label}
      title={label}
      className={`${cls} rounded-full ring-1 ring-zinc-700`}
    />
  ) : (
    <span
      title={label}
      className={`${cls} flex items-center justify-center rounded-full bg-indigo-900 text-xs font-bold`}
    >
      {label[0]?.toUpperCase()}
    </span>
  );
}
