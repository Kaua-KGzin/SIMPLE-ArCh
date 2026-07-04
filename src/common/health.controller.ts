import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health check para monitoramento externo (uptime, alertas). Público de
 * propósito — um monitor não deveria precisar de token. Faz um SELECT trivial
 * para provar que o banco responde, não só que o processo subiu.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok' | 'degraded'; db: boolean }> {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return { status: db ? 'ok' : 'degraded', db };
  }
}
