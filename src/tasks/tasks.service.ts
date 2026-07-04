import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { NotificationType, Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { GithubApiService } from './github-api.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

/** O que devolvemos junto com a task no board: assignee, labels e checklist. */
const taskInclude = {
  assignee: { select: { id: true, name: true, githubLogin: true, avatarUrl: true } },
  labels: { include: { label: true } },
  checklist: { orderBy: { order: 'asc' } },
} as const;

/**
 * TasksService — regra de negócio das Tasks e o lado "Plataforma -> GitHub".
 *
 * Fluxo de criação (fecha o sincronismo bidirecional):
 *   1. Valida workspace e vínculo com repositório.
 *   2. Cria a Issue no GitHub (usando o token do DONO do workspace).
 *   3. Persiste a Task já com o número/id da Issue como referência.
 *
 * ORDEM IMPORTA: criamos a Issue ANTES de gravar a Task. Se o GitHub falhar,
 * não gravamos uma Task órfã (sem Issue). O inverso geraria inconsistência.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubApi: GithubApiService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async create(workspaceId: string, creatorId: string, dto: CreateTaskDto): Promise<Task> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { owner: true },
    });

    if (!workspace) throw new NotFoundException('Workspace não encontrado.');

    await this.assertLabelsInWorkspace(workspaceId, dto.labelIds ?? []);

    // GitHub é OPCIONAL: só tentamos criar a Issue se o workspace tiver repo
    // vinculado e o dono tiver token válido. Sem isso (ou se a chamada ao
    // GitHub falhar), a task nasce só no Postgres — mesmo espírito
    // best-effort do syncIssue() usado em update/remove.
    let issue: { number: number; id: number } | null = null;
    if (workspace.githubRepoFullName && workspace.owner.githubAccessToken) {
      try {
        issue = await this.githubApi.createIssue(
          workspace.owner.githubAccessToken,
          workspace.githubRepoFullName,
          dto.title,
          dto.description,
        );
      } catch (err) {
        this.logger.error('Falha ao criar Issue no GitHub (task será criada só localmente):', err);
      }
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        workspaceId: workspace.id,
        creatorId,
        assigneeId: dto.assigneeId,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        labels: dto.labelIds?.length
          ? { create: dto.labelIds.map((labelId) => ({ labelId })) }
          : undefined,
        githubIssueNumber: issue?.number,
        githubIssueId: issue ? String(issue.id) : undefined,
        // status default = BACKLOG (o webhook de PR o moverá depois)
      },
      include: taskInclude,
    });

    this.logger.log(
      issue
        ? `Task ${task.id} criada e vinculada à Issue #${issue.number}.`
        : `Task ${task.id} criada sem vínculo com o GitHub.`,
    );
    await this.activity.record(
      workspaceId,
      'TASK_CREATED',
      `criou a task "${task.title}"`,
      creatorId,
      task.id,
    );
    this.realtime.emitToWorkspace(workspaceId, 'task:created', task);

    if (dto.assigneeId) {
      await this.notifications.notify({
        userId: dto.assigneeId,
        type: NotificationType.ASSIGNED,
        message: `atribuiu "${task.title}" a você`,
        workspaceId,
        actorId: creatorId,
        taskId: task.id,
      });
    }
    return task;
  }

  /**
   * Move a task de coluna no board (mudança manual de status).
   * O webhook também muda status (PR aberto/mergeado); aqui é a via humana.
   */
  async updateStatus(
    workspaceId: string,
    taskId: string,
    status: Task['status'],
    actorId?: string,
  ): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });
    if (!task) throw new NotFoundException('Task não encontrada neste workspace.');

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status },
      include: taskInclude,
    });

    // Espelha no GitHub: DONE fecha a Issue; sair de DONE reabre.
    // (O webhook issues.closed que isso dispara é idempotente — sem loop.)
    if (task.status !== status && (status === 'DONE' || task.status === 'DONE')) {
      await this.syncIssue(workspaceId, task.githubIssueNumber, {
        state: status === 'DONE' ? 'closed' : 'open',
      });
    }
    if (task.status !== status) {
      await this.activity.record(
        workspaceId,
        'TASK_MOVED',
        `moveu "${task.title}" para ${status}`,
        actorId,
        task.id,
      );
    }
    this.realtime.emitToWorkspace(workspaceId, 'task:updated', updated);
    return updated;
  }

  /**
   * Sincroniza a Issue no GitHub em modo BEST-EFFORT: se o GitHub estiver
   * fora do ar, a mudança local não é desfeita — só logamos o erro.
   * (Consistência eventual; uma fila BullMQ tornaria isso resiliente.)
   */
  private async syncIssue(
    workspaceId: string,
    issueNumber: number | null,
    data: { title?: string; body?: string | null; state?: 'open' | 'closed' },
  ): Promise<void> {
    if (!issueNumber) return;
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { owner: true },
      });
      if (!workspace?.githubRepoFullName || !workspace.owner.githubAccessToken) return;
      await this.githubApi.updateIssue(
        workspace.owner.githubAccessToken,
        workspace.githubRepoFullName,
        issueNumber,
        data,
      );
    } catch (err) {
      this.logger.error(`Sync da Issue #${issueNumber} falhou (seguindo sem desfazer):`, err);
    }
  }

  /** Apaga a task. Issues não podem ser apagadas via API — fechamos a do GitHub. */
  async remove(workspaceId: string, taskId: string, actorId?: string): Promise<void> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new NotFoundException('Task não encontrada neste workspace.');

    await this.prisma.task.delete({ where: { id: taskId } });
    await this.syncIssue(workspaceId, task.githubIssueNumber, { state: 'closed' });
    this.logger.log(`Task ${taskId} removida (Issue #${task.githubIssueNumber ?? '-'} fechada).`);
    await this.activity.record(
      workspaceId,
      'TASK_DELETED',
      `apagou a task "${task.title}"`,
      actorId,
    );
    this.realtime.emitToWorkspace(workspaceId, 'task:deleted', { id: taskId });
  }

  /**
   * Edição parcial (título, descrição, atribuição).
   * Se `assigneeId` vier preenchido, validamos que a pessoa é MEMBRO do
   * workspace — não faz sentido atribuir uma task a quem não está na equipe.
   */
  async update(
    workspaceId: string,
    taskId: string,
    dto: UpdateTaskDto,
    actorId?: string,
  ): Promise<Task> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, workspaceId } });
    if (!task) throw new NotFoundException('Task não encontrada neste workspace.');

    if (dto.assigneeId) {
      const membership = await this.prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: dto.assigneeId, workspaceId } },
      });
      if (!membership) {
        throw new BadRequestException('O responsável precisa ser membro do workspace.');
      }
    }

    if (dto.labelIds) await this.assertLabelsInWorkspace(workspaceId, dto.labelIds);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId, // string atribui, null desatribui, undefined não mexe
        priority: dto.priority,
        // undefined = não mexe; null = remove o prazo; string = define.
        dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
        // labelIds enviado SUBSTITUI o conjunto: apaga os vínculos e recria.
        labels: dto.labelIds
          ? { deleteMany: {}, create: dto.labelIds.map((labelId) => ({ labelId })) }
          : undefined,
      },
      include: taskInclude,
    });

    // Título/descrição mudaram? Espelha na Issue do GitHub (best-effort).
    if (dto.title !== undefined || dto.description !== undefined) {
      await this.syncIssue(workspaceId, task.githubIssueNumber, {
        title: dto.title,
        body: dto.description,
      });
    }

    // Atribuição mudou? Registra no feed com o nome de quem recebeu a task.
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      const assignee = (updated as Task & { assignee?: { name: string | null; githubLogin: string | null } | null })
        .assignee;
      const who = assignee ? (assignee.name ?? assignee.githubLogin ?? 'alguém') : null;
      await this.activity.record(
        workspaceId,
        'TASK_ASSIGNED',
        who
          ? `atribuiu "${updated.title}" a ${who}`
          : `removeu o responsável de "${updated.title}"`,
        actorId,
        task.id,
      );
      if (dto.assigneeId) {
        await this.notifications.notify({
          userId: dto.assigneeId,
          type: NotificationType.ASSIGNED,
          message: `atribuiu "${updated.title}" a você`,
          workspaceId,
          actorId,
          taskId: task.id,
        });
      }
    }
    this.realtime.emitToWorkspace(workspaceId, 'task:updated', updated);
    return updated;
  }

  /**
   * "Código" da task: o diff do PR que a referenciou (via webhook).
   * Usa o token do dono do workspace, como nas demais chamadas ao GitHub.
   */
  async getCode(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: { workspace: { include: { owner: true } } },
    });
    if (!task) throw new NotFoundException('Task não encontrada neste workspace.');
    if (!task.githubPrNumber) {
      throw new NotFoundException(
        'Nenhum PR referenciou esta task ainda. Crie a branch feature/issue-' +
          `${task.githubIssueNumber ?? 'N'} e abra um PR.`,
      );
    }
    const { workspace } = task;
    if (!workspace.githubRepoFullName || !workspace.owner.githubAccessToken) {
      throw new BadRequestException('Workspace sem repositório ou sem token do dono.');
    }
    return this.githubApi.getPullRequestCode(
      workspace.owner.githubAccessToken,
      workspace.githubRepoFullName,
      task.githubPrNumber,
    );
  }

  /**
   * Lista as tasks do board (com assignee, labels e checklist).
   * `q` (opcional) faz busca ampla: título, descrição E comentários —
   * `comments: { some }` deixa o Postgres resolver o join sem trazer os
   * comentários para a aplicação.
   */
  async listByWorkspace(workspaceId: string, q?: string): Promise<Task[]> {
    const term = q?.trim();
    return this.prisma.task.findMany({
      where: {
        workspaceId,
        ...(term
          ? {
              OR: [
                { title: { contains: term, mode: 'insensitive' } },
                { description: { contains: term, mode: 'insensitive' } },
                { comments: { some: { body: { contains: term, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: taskInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Busca uma task já no formato do board (assignee, labels, checklist). */
  async getForBoard(workspaceId: string, taskId: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException('Task não encontrada neste workspace.');
    return task;
  }

  /** Re-emite a task no board — usado por mudanças fora do TasksService (checklist). */
  async emitTaskUpdated(workspaceId: string, taskId: string): Promise<void> {
    const task = await this.getForBoard(workspaceId, taskId);
    this.realtime.emitToWorkspace(workspaceId, 'task:updated', task);
  }

  /**
   * Garante que todos os labelIds informados existem E pertencem ao workspace
   * — impede vincular a uma task uma label de outro workspace.
   */
  private async assertLabelsInWorkspace(workspaceId: string, labelIds: string[]): Promise<void> {
    const unique = [...new Set(labelIds)];
    if (unique.length === 0) return;
    const count = await this.prisma.label.count({
      where: { id: { in: unique }, workspaceId },
    });
    if (count !== unique.length) {
      throw new BadRequestException('Uma ou mais etiquetas não pertencem a este workspace.');
    }
  }
}
