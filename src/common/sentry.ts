import * as Sentry from '@sentry/node';

/**
 * Inicializa o Sentry se — e somente se — `SENTRY_DSN` estiver definida.
 *
 * Sem DSN, isto é um no-op e `Sentry.captureException` também não faz nada:
 * o app roda igual em dev/local sem exigir conta Sentry. Deve ser chamado o
 * mais cedo possível no boot, antes de instanciar o app Nest.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Amostragem de performance: 10% por padrão, ajustável por env sem deploy.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}
