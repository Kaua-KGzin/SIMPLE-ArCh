import { flushSync } from 'react-dom';

/**
 * Aplica uma atualização de estado dentro de uma View Transition, para o
 * navegador animar o "antes → depois" (ex.: um card deslizando de coluna).
 *
 * `flushSync` força o React a aplicar o setState de forma síncrona dentro do
 * callback, senão o browser captura o DOM antes da mudança e não anima.
 *
 * Degrada sozinho: sem suporte à API (ou com prefers-reduced-motion), só roda
 * a atualização direto — mesma correção, sem animação.
 */
export function withViewTransition(update: () => void): void {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };

  if (prefersReduced || typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}
