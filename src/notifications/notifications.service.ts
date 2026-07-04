import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const actorSelect = {
  actor: { select: { id: true, name: true, githubLogin: true, avatarUrl: true } },
} as const;

interface NotifyInput {
  userId: string;
  type: NotificationType;
  message: string;
  workspaceId: string;
  actorId?: string | null;
  taskId?: string | null;
  commentId?: string | null;
}

/**
 * NotificationsService — notificações pessoais (menção, atribuição...).
 *
 * `notify()` é BEST-EFFORT, no mesmo espírito do ActivityService: nunca pode
 * derrubar a operação principal (comentar, atribuir task...).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    // Nunca notifica a própria ação (ex.: mencionar a si mesmo, autoatribuir-se).
    if (input.actorId && input.actorId === input.userId) return;
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          message: input.message,
          workspaceId: input.workspaceId,
          actorId: input.actorId,
          taskId: input.taskId,
          commentId: input.commentId,
        },
        include: actorSelect,
      });
      this.realtime.emitToUser(input.userId, 'notification:new', notification);
    } catch (err) {
      this.logger.error('Falha ao criar notificação (seguindo sem desfazer):', err);
    }
  }

  async listForUser(userId: string, limit = 30) {
    return this.prisma.notification.findMany({
      where: { userId },
      include: actorSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notificação não encontrada.');
    await this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
