import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { toast } from '../lib/toast';
import { Avatar } from './Avatar';
import { IconBell } from './icons';
import { displayName, type Notification } from '../types';

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
  const [bump, setBump] = useState(0); // muda a cada nova → reanima o badge
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    api<Notification[]>('/notifications').then(setNotifications).catch(() => {});

    const socket = getSocket();
    socket.connect();
    const onNew = (n: Notification) => {
      setNotifications((prev) => [n, ...prev]);
      setBump((b) => b + 1);
      // Feedback mesmo com o dropdown fechado.
      const who = n.actor ? `${displayName(n.actor)} ` : '';
      toast.info(`${who}${n.message}`);
    };
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
    <div ref={rootRef} className="fixed right-5 top-5 z-30">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notificações"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line-2 bg-panel/90 text-soft backdrop-blur transition hover:border-faint"
      >
        <IconBell size={17} />
        {unread > 0 && (
          <span
            key={bump}
            className="badge-pop absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="dialog-in absolute right-0 mt-2 max-h-96 w-[calc(100vw-2.5rem)] max-w-sm overflow-y-auto rounded-2xl border border-line bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-sm font-semibold">Notificações</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-violet hover:brightness-125">
                marcar todas como lidas
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-faint">Nenhuma notificação ainda.</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => markRead(n)}
                    className={`flex w-full items-start gap-2.5 border-b border-line/60 px-4 py-3 text-left text-xs transition hover:bg-base-2 ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    {n.actor && <Avatar user={n.actor} size={5} />}
                    <span className="min-w-0 flex-1">
                      <span className="block leading-relaxed text-soft">
                        {n.actor && <span className="font-semibold text-ink">{displayName(n.actor)} </span>}
                        {n.message}
                      </span>
                      <span className="text-[10px] text-faint-2">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-violet" />}
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
