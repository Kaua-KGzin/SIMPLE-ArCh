/**
 * Resolve a allowlist de origens do CORS a partir de `FRONTEND_URL`
 * (aceita uma ou várias, separadas por vírgula — útil para preview + prod).
 *
 * FALHA FECHADO: se a variável não estiver definida, lançamos em vez de
 * deixar `cors` cair no comportamento padrão (que reflete QUALQUER origem
 * quando `origin` é `undefined`) — um `FRONTEND_URL` esquecido não pode
 * virar "aceita requisição autenticada de qualquer site" silenciosamente.
 */
export function resolveAllowedOrigins(): string[] {
  const origins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error(
      'FRONTEND_URL não configurada — obrigatória para restringir o CORS (evita abrir para qualquer origem).',
    );
  }
  return origins;
}
