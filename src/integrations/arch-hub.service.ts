import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

/**
 * Integração com o Arch Hub (System-Arch) — o catálogo central da linha Arch.
 * Contrato: System-Arch/docs/ARCH-LINE.md. As variáveis são as mesmas em todos
 * os sistemas da linha, então um único .env configura o ecossistema inteiro.
 *
 * Desligada por padrão (sem ARCHHUB_URL nada acontece). Nunca derruba nem
 * atrasa o boot: o registro roda em segundo plano e falhas viram warning.
 *
 * Na Vercel (serverless) não há processo de longa duração para mandar
 * heartbeat: registramos a cada cold start e o Hub faz o health check ativo
 * em /health — que é o que mantém o status UP.
 */
export const ARCH_HUB_SYSTEM_ID = 'simple-arch';

export const INITIAL_RETRY_MS = 2_000;
/** Teto do backoff sem heartbeat (Vercel / ARCHHUB_HEARTBEAT_SECONDS=0): sem ele um Hub fora do ar nunca seria re-tentado. */
export const MAX_RETRY_MS = 300_000;

/**
 * Próximo passo do ciclo do adaptador (contrato: backoff 2s, 4s, 8s… até o período do heartbeat).
 * `delayMs: null` = parar (registrado em modo só-registro).
 */
export function nextArchHubDelay(
  registered: boolean,
  heartbeatMs: number,
  retryMs: number,
): { delayMs: number | null; nextRetryMs: number } {
  if (registered) {
    return { delayMs: heartbeatMs > 0 ? heartbeatMs : null, nextRetryMs: INITIAL_RETRY_MS };
  }
  const ceiling = heartbeatMs > 0 ? heartbeatMs : MAX_RETRY_MS;
  return { delayMs: retryMs, nextRetryMs: Math.min(retryMs * 2, ceiling) };
}

export interface ArchHubConfig {
  hubUrl: string;
  token?: string;
  publicUrl: string;
  heartbeatMs: number;
}

export function resolveArchHubConfig(env: NodeJS.ProcessEnv = process.env): ArchHubConfig | null {
  const hubUrl = env.ARCHHUB_URL?.trim().replace(/\/+$/, '');
  if (!hubUrl) return null;

  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  const publicUrl = (
    env.ARCHHUB_PUBLIC_URL?.trim() ||
    (vercelHost ? `https://${vercelHost}` : `http://localhost:${env.PORT ?? 3000}`)
  ).replace(/\/+$/, '');

  const seconds = Number.parseInt(env.ARCHHUB_HEARTBEAT_SECONDS ?? '', 10);
  const heartbeatSeconds = env.VERCEL ? 0 : Number.isFinite(seconds) ? Math.max(0, seconds) : 20;

  return { hubUrl, token: env.ARCHHUB_TOKEN || undefined, publicUrl, heartbeatMs: heartbeatSeconds * 1000 };
}

@Injectable()
export class ArchHubService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ArchHubService.name);
  private timer?: NodeJS.Timeout;
  private registered = false;
  private stopped = false;
  private retryMs = INITIAL_RETRY_MS;

  constructor(
    private readonly config: ArchHubConfig | null = resolveArchHubConfig(),
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config) return;
    this.stopped = false;
    void this.loop();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Um tick e agenda o próximo: heartbeat se registrado, backoff exponencial se não. */
  private async loop(): Promise<void> {
    if (!this.config || this.stopped) return;
    await this.tick();
    if (this.stopped) return;
    const { delayMs, nextRetryMs } = nextArchHubDelay(this.registered, this.config.heartbeatMs, this.retryMs);
    this.retryMs = nextRetryMs;
    if (delayMs === null) return;
    this.timer = setTimeout(() => void this.loop(), delayMs);
    this.timer.unref(); // não segura o processo vivo (testes, shutdown)
  }

  /** Registra se ainda não registrou; senão manda heartbeat. Exposto para testes. */
  async tick(): Promise<void> {
    if (!this.config) return;
    try {
      this.registered = this.registered ? await this.heartbeat() : await this.register();
    } catch (err) {
      this.registered = false;
      this.logger.warn(`Arch Hub indisponível em ${this.config.hubUrl}: ${(err as Error).message}`);
    }
  }

  private async register(): Promise<boolean> {
    const { publicUrl } = this.config!;
    const res = await this.post('/api/v1/systems', {
      id: ARCH_HUB_SYSTEM_ID,
      name: 'SIMPLE ArCh',
      baseUrl: publicUrl,
      healthCheckUrl: `${publicUrl}/health`,
      description: 'Colaboração para equipes de dev — boards, tasks e sync com GitHub',
      tags: ['arch-line', 'role:collaboration', 'nestjs', 'react'],
      connectsTo: ['arch-hub'],
    });
    if (!res.ok) {
      this.logger.warn(`Arch Hub recusou o registro: HTTP ${res.status}`);
      return false;
    }
    this.logger.log(`Registrado no Arch Hub ${this.config!.hubUrl} como ${ARCH_HUB_SYSTEM_ID} (${publicUrl})`);
    return true;
  }

  /**
   * Só 2xx mantém o registro. 404 = o Hub reiniciou sem persistência e esqueceu este sistema;
   * 401/403 (token rotacionado) ou 5xx antes contavam como sucesso, e o sistema ficava mandando
   * heartbeat para um Hub que o recusava enquanto a janela stale-after o marcava DOWN.
   */
  private async heartbeat(): Promise<boolean> {
    const res = await this.post(`/api/v1/systems/${ARCH_HUB_SYSTEM_ID}/heartbeat`);
    if (!res.ok && res.status !== 404) {
      this.logger.warn(`Arch Hub recusou o heartbeat: HTTP ${res.status}; registrando de novo`);
    }
    return res.ok;
  }

  private post(path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.config!.token) headers['X-Hub-Token'] = this.config!.token;
    return this.fetchFn(`${this.config!.hubUrl}${path}`, {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  }
}
