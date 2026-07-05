import { displayName, type PublicUser } from '../types';
import { textOn } from '../lib/task-meta';

const AVA_COLORS = ['#8b5cf6', '#3b82f6', '#c084fc', '#22c55e', '#06b6d4', '#f97316'];
function colorFor(s: string): string {
  return AVA_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVA_COLORS.length];
}

/** Avatar com fallback para a inicial colorida (funciona com ou sem GitHub). */
export function Avatar({ user, size = 6 }: { user: PublicUser; size?: 5 | 6 | 8 }) {
  const cls = { 5: 'h-5 w-5 text-[9.5px]', 6: 'h-6 w-6 text-[11px]', 8: 'h-8 w-8 text-xs' }[size];
  const label = displayName(user);
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={label} title={label} className={`${cls} rounded-full ring-1 ring-line-2`} />;
  }
  const bg = colorFor(label);
  return (
    <span
      title={label}
      className={`${cls} flex items-center justify-center rounded-full font-bold`}
      style={{ background: bg, color: textOn(bg) }}
    >
      {label[0]?.toUpperCase()}
    </span>
  );
}
