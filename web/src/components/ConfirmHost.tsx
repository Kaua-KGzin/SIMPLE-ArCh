import { useEffect, useState } from 'react';
import { resolveConfirm, subscribeConfirm, type ConfirmRequest } from '../lib/confirm';

/**
 * Modal de confirmação global — substitui o confirm() nativo. Montado uma vez
 * no App; escuta pedidos de lib/confirm e resolve a Promise conforme a escolha.
 */
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  useEffect(() => subscribeConfirm(setReq), []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false);
      if (e.key === 'Enter') resolveConfirm(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [req]);

  if (!req) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={() => resolveConfirm(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="dialog-in w-full max-w-sm rounded-[18px] border border-line-2 bg-panel p-6 shadow-2xl"
      >
        <h2 className="font-display text-lg font-semibold">{req.title}</h2>
        {req.message && <p className="mt-2 text-sm text-soft-2">{req.message}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => resolveConfirm(false)}
            className="rounded-[10px] border border-line-2 px-4 py-2 text-sm text-soft transition hover:border-faint"
          >
            Cancelar
          </button>
          <button
            autoFocus
            onClick={() => resolveConfirm(true)}
            className={`rounded-[10px] px-4 py-2 text-sm font-semibold text-white transition ${
              req.danger ? 'bg-red-600 hover:bg-red-500' : 'btn-brand'
            }`}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
