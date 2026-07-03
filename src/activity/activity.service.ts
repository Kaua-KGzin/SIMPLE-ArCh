import { Injectable, Logger } from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Select público do ator, no mesmo formato dos demais endpoints. */
const actorSelect = {
  actor: { select: { id: true, name: true, githubLogin: true, avatarUrl: true } },
} as const;

/**
 * ActivityService — feed de atividade NATIVO do workspace.
 *
 * `record()` é sempre BEST-EFFORT: um feed que falhou nunca pode derrubar a
 * operação principal (criar task, comentar...). Mesmo espírito do syncIssue
 * do TasksService.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    workspaceId: string,
    type: ActivityType,
    summary: string,
    actorId?: string | null,
    taskId?: string | null,
  ): Promise<void> {
    try {
      await this.prisma.activityEvent.create({
        data: { workspaceId, type, summary, actorId, taskId },
      });
    } catch (err) {
      this.logger.error(`Falha ao registrar atividade ${type} (seguindo sem desfazer):`, err);
    }
  }

  /** Últimos eventos do workspace, mais recentes primeiro. */
  async listByWorkspace(workspaceId: string, limit = 50) {
    return this.prisma.activityEvent.findMany({
      where: { workspaceId },
      include: actorSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
