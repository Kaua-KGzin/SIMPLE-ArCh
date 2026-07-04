import * as Sentry from '@sentry/react';

/**
 * Inicializa o Sentry no frontend só se `VITE_SENTRY_DSN` estiver definida no
 * build. Sem DSN, é no-op — dev local roda sem exigir conta Sentry.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}
