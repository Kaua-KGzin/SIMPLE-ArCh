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

  constructor(
    private readonly config: ArchHubConfig | null = resolveArchHubConfig(),
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config) return;
    void this.tick();
    if (this.config.heartbeatMs > 0) {
      this.timer = setInterval(() => void this.tick(), this.config.heartbeatMs);
      this.timer.unref(); // não segura o processo vivo (testes, shutdown)
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
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

  /** 404 = o Hub reiniciou sem persistência e esqueceu este sistema: força novo registro. */
  private async heartbeat(): Promise<boolean> {
    const res = await this.post(`/api/v1/systems/${ARCH_HUB_SYSTEM_ID}/heartbeat`);
    return res.status !== 404;
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
