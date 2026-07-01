import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { extractTaskNumbers } from './task-reference.util';

/**
 * Tipagem parcial dos payloads do GitHub. Modelamos só o que usamos.
 */
interface GithubRepository {
  id: number;
  full_name: string;
}

interface GithubIssuesPayload {
  action: string; // 'opened' | 'edited' | 'closed' | 'reopened' | 'deleted' ...
  issue: {
    id: number;
    number: number;
    title: string;
    body: string | null;
  };
  repository: GithubRepository;
}

interface GithubPullRequestPayload {
  action: string; // 'opened' | 'synchronize' | 'reopened' | 'closed' ...
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    merged: boolean;
    head: { ref: string }; // nome da branch de origem
  };
  repository: GithubRepository;
}

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica a assinatura HMAC SHA-256 enviada pelo GitHub.
   * `rawBody` precisa ser o corpo CRU (Buffer), não o JSON já parseado —
   * qualquer reserialização muda os bytes e quebra o hash.
   */
  verifySignature(rawBody: Buffer, signatureHeader?: string): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret || !signatureHeader) return false;

    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    // Comparação em tempo constante (anti timing-attack). Tamanhos diferentes => falso.
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * Roteia o evento pelo header `X-GitHub-Event`.
   * Um único endpoint recebe TODOS os tipos; aqui despachamos para o handler certo.
   */
  async handleEvent(eventType: string, payload: unknown): Promise<void> {
    switch (eventType) {
      case 'pull_request':
        await this.handlePullRequest(payload as GithubPullRequestPayload);
        break;
      case 'issues':
        await this.handleIssues(payload as GithubIssuesPayload);
        break;
      default:
        this.logger.debug(`Evento ignorado: ${eventType}`);
    }
  }

  /**
   * NÚCLEO DA PLATAFORMA: ao abrir/atualizar um PR que referencia uma task,
   * a Task correspondente vai para IN_REVIEW automaticamente.
   * Se o PR for mergeado/fechado, movemos para DONE.
   */
  private async handlePullRequest(payload: GithubPullRequestPayload): Promise<void> {
    const { action, pull_request: pr, repository } = payload;

    const taskNumbers = extractTaskNumbers(pr.title, pr.body, pr.head.ref);
    if (taskNumbers.length === 0) {
      this.logger.debug(`PR #${pr.number} não referencia nenhuma task.`);
      return;
    }

    // Descobrimos o workspace pelo ID do repositório (imutável).
    const workspace = await this.prisma.workspace.findUnique({
      where: { githubRepoId: String(repository.id) },
    });
    if (!workspace) {
      this.logger.warn(`Repo ${repository.full_name} não vinculado a nenhum workspace.`);
      return;
    }

    // Decide o novo status conforme a ação do PR.
    let newStatus: TaskStatus | null = null;
    if (['opened', 'reopened', 'synchronize', 'ready_for_review'].includes(action)) {
      newStatus = TaskStatus.IN_REVIEW;
    } else if (action === 'closed' && pr.merged) {
      newStatus = TaskStatus.DONE;
    }
    if (!newStatus) return;

    // updateMany é idempotente e seguro: se a task não existir, simplesmente
    // atualiza 0 linhas (sem lançar erro). Atualizamos todas as tasks citadas.
    const result = await this.prisma.task.updateMany({
      where: {
        workspaceId: workspace.id,
        githubIssueNumber: { in: taskNumbers },
      },
      // Além do status, guardamos o nº do PR: é ele que permite à UI
      // mostrar o diff/código da task ("qual PR resolve esta task?").
      data: { status: newStatus, githubPrNumber: pr.number },
    });

    this.logger.log(
      `PR #${pr.number} (${action}) → ${result.count} task(s) movida(s) para ${newStatus}.`,
    );
  }

  /**
   * GitHub -> Plataforma: sincroniza Tasks quando issues mudam no GitHub.
   *
   *   opened   -> cria a Task (se ainda não existir)
   *   edited   -> atualiza título/descrição
   *   closed   -> Task DONE
   *   reopened -> Task volta para TODO
   *   deleted  -> remove a Task
   *
   * CUIDADO COM O LOOP: quando a PLATAFORMA cria a Issue, o GitHub dispara
   * `issues.opened` de volta para nós. O upsert pela chave única
   * (workspaceId + githubIssueNumber) torna isso inofensivo: a Task já
   * existe, então nada é duplicado. Idempotência > flags de "ignorar".
   */
  private async handleIssues(payload: GithubIssuesPayload): Promise<void> {
    const { action, issue, repository } = payload;

    const workspace = await this.prisma.workspace.findUnique({
      where: { githubRepoId: String(repository.id) },
    });
    if (!workspace) {
      this.logger.warn(`Repo ${repository.full_name} não vinculado a nenhum workspace.`);
      return;
    }

    const key = {
      workspaceId_githubIssueNumber: {
        workspaceId: workspace.id,
        githubIssueNumber: issue.number,
      },
    };

    switch (action) {
      case 'opened':
      case 'reopened':
        await this.prisma.task.upsert({
          where: key,
          // Se já existe (criada pela plataforma ou reaberta), só garante o status.
          update: action === 'reopened' ? { status: TaskStatus.TODO } : {},
          create: {
            title: issue.title,
            description: issue.body,
            workspaceId: workspace.id,
            // Issues criadas direto no GitHub não têm autor na plataforma;
            // atribuímos a autoria ao dono do workspace.
            creatorId: workspace.ownerId,
            githubIssueNumber: issue.number,
            githubIssueId: String(issue.id),
            status: TaskStatus.BACKLOG,
          },
        });
        this.logger.log(`Issue #${issue.number} (${action}) sincronizada como Task.`);
        break;

      case 'edited':
        await this.prisma.task.updateMany({
          where: { workspaceId: workspace.id, githubIssueNumber: issue.number },
          data: { title: issue.title, description: issue.body },
        });
        this.logger.log(`Issue #${issue.number} editada → Task atualizada.`);
        break;

      case 'closed':
        await this.prisma.task.updateMany({
          where: { workspaceId: workspace.id, githubIssueNumber: issue.number },
          data: { status: TaskStatus.DONE },
        });
        this.logger.log(`Issue #${issue.number} fechada → Task DONE.`);
        break;

      case 'deleted':
        await this.prisma.task.deleteMany({
          where: { workspaceId: workspace.id, githubIssueNumber: issue.number },
        });
        this.logger.log(`Issue #${issue.number} apagada → Task removida.`);
        break;

      default:
        this.logger.debug(`Ação de issue ignorada: ${action}`);
    }
  }
}
