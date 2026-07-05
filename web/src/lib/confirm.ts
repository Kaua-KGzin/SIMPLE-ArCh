// confirm() nativo é feio e bloqueia a thread. Este é um substituto assíncrono:
// `await confirmDialog({ ... })` resolve true/false quando o usuário decide.
// O ConfirmHost (montado no App) escuta o pedido e renderiza o modal.

export interface ConfirmRequest {
  id: number;
  title: string;
  message?: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

type Listener = (req: ConfirmRequest | null) => void;

let current: ConfirmRequest | null = null;
let seq = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(current);
}

export function subscribeConfirm(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function resolveConfirm(ok: boolean) {
  if (!current) return;
  current.resolve(ok);
  current = null;
  emit();
}

export function confirmDialog(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    current = {
      id: ++seq,
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Confirmar',
      danger: opts.danger ?? false,
      resolve,
    };
    emit();
  });
}
