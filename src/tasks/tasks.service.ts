import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GithubApiService } from './github-api.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

/** Campos públicos do assignee devolvidos junto com a task (para o board). */
const taskInclude = {
  assignee: { select: { id: true, name: true, githubLogin: true, avatarUrl: true } },
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
  ) {}

  async create(workspaceId: string, creatorId: string, dto: CreateTaskDto): Promise<Task> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { owner: true },
    });

    if (!workspace) throw new NotFoundException('Workspace não encontrado.');
    if (!workspace.githubRepoFullName) {
      throw new BadRequestException('Workspace não está vinculado a um repositório do GitHub.');
    }
    if (!workspace.owner.githubAccessToken) {
      throw new BadRequestException('O dono do workspace não possui token do GitHub válido.');
    }

    // 2. Cria a Issue no GitHub em nome do dono do workspace.
    const issue = await this.githubApi.createIssue(
      workspace.owner.githubAccessToken,
      workspace.githubRepoFullName,
      dto.title,
      dto.description,
    );

    // 3. Persiste a Task referenciando a Issue.
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        workspaceId: workspace.id,
        creatorId,
        assigneeId: dto.assigneeId,
        githubIssueNumber: issue.number,
        githubIssueId: String(issue.id),
        // status default = BACKLOG (o webhook de PR o moverá depois)
      },
    });

    this.logger.log(`Task ${task.id} criada e vinculada à Issue #${issue.number}.`);
    return task;
  }

  /**
   * Move a task de coluna no board (mudança manual de status).
   * O webhook também muda status (PR aberto/mergeado); aqui é a via humana.
   */
  async updateStatus(workspaceId: string, taskId: string, status: Task['status']): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });
    if (!task) throw new NotFoundException('Task não encontrada neste workspace.');

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status },
      include: taskInclude,
    });
  }

  /**
   * Edição parcial (título, descrição, atribuição).
   * Se `assigneeId` vier preenchido, validamos que a pessoa é MEMBRO do
   * workspace — não faz sentido atribuir uma task a quem não está na equipe.
   */
  async update(workspaceId: string, taskId: string, dto: UpdateTaskDto): Promise<Task> {
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

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId, // string atribui, null desatribui, undefined não mexe
      },
      include: taskInclude,
    });
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

  /** Lista as tasks de um workspace (board), já com o assignee para os avatares. */
  async listByWorkspace(workspaceId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { workspaceId },
      include: taskInclude,
      orderBy: { createdAt: 'desc' },
    });
  }
}
