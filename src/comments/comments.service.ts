import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

/** Select público do autor, mesmo formato dos demais endpoints. */
const authorInclude = {
  author: { select: { id: true, name: true, githubLogin: true, avatarUrl: true } },
} as const;

/**
 * CommentsService — comunicação nativa por task.
 *
 * Permissões: qualquer MEMBRO do workspace lê e comenta; apagar é só do
 * autor ou de OWNER/ADMIN (moderação).
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async create(workspaceId: string, taskId: string, authorId: string, dto: CreateCommentDto) {
    await this.assertMembership(authorId, workspaceId);
    const task = await this.findTask(workspaceId, taskId);

    const comment = await this.prisma.comment.create({
      data: { body: dto.body, taskId: task.id, authorId },
      include: authorInclude,
    });

    await this.activity.record(
      workspaceId,
      'COMMENT_ADDED',
      `comentou em "${task.title}"`,
      authorId,
      task.id,
    );
    this.realtime.emitToWorkspace(workspaceId, 'comment:created', comment);
    await this.notifyMentions(workspaceId, task.id, authorId, comment.body, comment.author.name ?? comment.author.githubLogin);
    return comment;
  }

  /** Casa "@Nome" / "@login" (mesmo formato inserido pelo front) com membros do workspace. */
  private async notifyMentions(
    workspaceId: string,
    taskId: string,
    authorId: string,
    body: string,
    authorName: string | null | undefined,
  ): Promise<void> {
    const mentioned = [...body.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
    if (mentioned.length === 0) return;

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, githubLogin: true } } },
    });

    for (const member of members) {
      const tag = (member.user.name ?? member.user.githubLogin ?? '').replace(/\s+/g, '').toLowerCase();
      if (tag && mentioned.includes(tag)) {
        await this.notifications.notify({
          userId: member.user.id,
          type: NotificationType.MENTION,
          message: `${authorName ?? 'alguém'} mencionou você num comentário`,
          workspaceId,
          actorId: authorId,
          taskId,
        });
      }
    }
  }

  async list(workspaceId: string, taskId: string, userId: string) {
    await this.assertMembership(userId, workspaceId);
    const task = await this.findTask(workspaceId, taskId);
    return this.prisma.comment.findMany({
      where: { taskId: task.id },
      include: authorInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(workspaceId: string, taskId: string, commentId: string, userId: string) {
    const membership = await this.assertMembership(userId, workspaceId);
    await this.findTask(workspaceId, taskId);

    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });
    if (!comment) throw new NotFoundException('Comentário não encontrado.');

    const isAuthor = comment.authorId === userId;
    const isModerator = membership.role === MemberRole.OWNER || membership.role === MemberRole.ADMIN;
    if (!isAuthor && !isModerator) {
      throw new ForbiddenException('Só o autor (ou OWNER/ADMIN) pode apagar o comentário.');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    this.realtime.emitToWorkspace(workspaceId, 'comment:deleted', { id: commentId, taskId });
  }

  /** 404 para não-membro (não revela a existência do workspace). */
  private async assertMembership(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) throw new NotFoundException('Workspace não encontrado.');
    return membership;
  }

  private async findTask(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new NotFoundException('Task não encontrada neste workspace.');
    return task;
  }
}
