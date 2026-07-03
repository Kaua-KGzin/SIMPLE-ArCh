import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { CreateCommentDto } from './dto/create-comment.dto';

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
    return comment;
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
