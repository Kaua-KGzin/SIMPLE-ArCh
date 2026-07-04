import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Avatar } from './Avatar';
import { displayName, type Notification, type NotificationType } from '../types';

const TYPE_ICON: Record<NotificationType, string> = {
  MENTION: '💬',
  ASSIGNED: '👤',
  COMMENT: '💬',
};

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * Sino de notificações — fica fixo no canto, disponível em qualquer página
 * autenticada. Recebe notificações em tempo real via WebSocket e também
 * busca o histórico via REST ao montar.
 */
export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    api<Notification[]>('/notifications').then(setNotifications).catch(() => {});

    const socket = getSocket();
    socket.connect();
    const onNew = (n: Notification) => setNotifications((prev) => [n, ...prev]);
    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const markRead = useCallback(async (n: Notification) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      api(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
    }
    setOpen(false);
    if (n.workspaceId) navigate(`/w/${n.workspaceId}`);
  }, [navigate]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api('/notifications/read-all', { method: 'PATCH' }).catch(() => {});
  }, []);

  return (
    <div ref={rootRef} className="fixed right-5 top-5 z-20">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notificações"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg hover:border-zinc-500"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 max-h-96 w-[calc(100vw-2.5rem)] max-w-sm overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <span className="text-sm font-semibold">Notificações</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-indigo-400 hover:text-indigo-300">
                marcar todas como lidas
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-zinc-600">Nenhuma notificação ainda.</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => markRead(n)}
                    className={`flex w-full items-start gap-2.5 border-b border-zinc-800/60 px-4 py-3 text-left text-xs hover:bg-zinc-800/60 ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">{TYPE_ICON[n.type] ?? '🔔'}</span>
                    {n.actor && <Avatar user={n.actor} size={5} />}
                    <span className="min-w-0 flex-1">
                      <span className="block leading-relaxed text-zinc-300">
                        {n.actor && <span className="font-medium text-zinc-100">{displayName(n.actor)} </span>}
                        {n.message}
                      </span>
                      <span className="text-[10px] text-zinc-600">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
