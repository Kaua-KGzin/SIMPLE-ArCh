import { useEffect, useState } from 'react';
import { dismiss, subscribeToasts, type ToastItem } from '../lib/toast';

const STYLE: Record<ToastItem['kind'], { bar: string; icon: string }> = {
  success: { bar: 'bg-green-500', icon: '✓' },
  error: { bar: 'bg-red-500', icon: '!' },
  info: { bar: 'bg-indigo-500', icon: 'i' },
};

/**
 * Pilha de toasts no canto inferior direito. Montado uma vez no App; escuta o
 * event bus de lib/toast. Cada toast entra deslizando e some sozinho.
 */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const s = STYLE[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="toast-in pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/95 py-3 pl-3 pr-2 shadow-2xl backdrop-blur"
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${s.bar}`}>
              {s.icon}
            </span>
            <p className="flex-1 text-sm text-zinc-100">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-zinc-500 hover:text-zinc-200"
              aria-label="Dispensar"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
