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

  /** Lista as tasks de um workspace (board). */
  async listByWorkspace(workspaceId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
