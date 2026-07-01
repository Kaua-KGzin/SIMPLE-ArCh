import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { MemberRole, Workspace } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GithubApiService } from '../tasks/github-api.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { LinkRepoDto } from './dto/link-repo.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

/**
 * WorkspacesService — CRUD de Workspace + vínculo de repo + membros.
 *
 * Regras de permissão (checadas SEMPRE no service, nunca só no front):
 *   - Qualquer autenticado pode CRIAR um workspace (vira OWNER).
 *   - Ver workspace/board: precisa ser membro.
 *   - Vincular repo / convidar / remover membro: OWNER ou ADMIN.
 *   - Deletar workspace: só OWNER.
 */
@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubApi: GithubApiService,
  ) {}

  // --------------------------------------------------------------------------
  //  CRIAÇÃO
  // --------------------------------------------------------------------------

  async create(userId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    // Se o usuário já informou o repo, resolvemos o ID no GitHub ANTES de
    // gravar qualquer coisa — se o repo não existir, nada é persistido.
    let repo: { id: number; fullName: string } | null = null;
    if (dto.repoFullName) {
      repo = await this.resolveRepo(userId, dto.repoFullName);
    }

    const slug = await this.generateUniqueSlug(dto.name);

    // Transação: workspace + membership OWNER nascem juntos ou nada nasce.
    // Um workspace sem o dono como membro seria um estado inconsistente.
    const workspace = await this.prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: dto.name,
          slug,
          ownerId: userId,
          githubRepoId: repo ? String(repo.id) : null,
          githubRepoFullName: repo ? repo.fullName : null,
        },
      });
      await tx.workspaceMember.create({
        data: { userId, workspaceId: ws.id, role: MemberRole.OWNER },
      });
      return ws;
    });

    this.logger.log(
      `Workspace "${workspace.slug}" criado por ${userId}` +
        (repo ? ` (repo ${repo.fullName})` : ''),
    );
    return workspace;
  }

  // --------------------------------------------------------------------------
  //  LEITURA
  // --------------------------------------------------------------------------

  /** Lista os workspaces dos quais o usuário é membro. */
  async listMine(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: { _count: { select: { members: true, tasks: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Detalhe do workspace (com membros). Exige ser membro. */
  async getById(userId: string, workspaceId: string) {
    await this.assertMembership(userId, workspaceId);
    return this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, githubLogin: true, avatarUrl: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }

  // --------------------------------------------------------------------------
  //  VÍNCULO DE REPOSITÓRIO
  // --------------------------------------------------------------------------

  async linkRepo(userId: string, workspaceId: string, dto: LinkRepoDto): Promise<Workspace> {
    await this.assertMembership(userId, workspaceId, [MemberRole.OWNER, MemberRole.ADMIN]);

    const repo = await this.resolveRepo(userId, dto.repoFullName);

    // githubRepoId é @unique: um repo não pode pertencer a dois workspaces
    // (senão o webhook não saberia qual board atualizar).
    const taken = await this.prisma.workspace.findUnique({
      where: { githubRepoId: String(repo.id) },
    });
    if (taken && taken.id !== workspaceId) {
      throw new ConflictException(
        `O repositório ${repo.fullName} já está vinculado ao workspace "${taken.name}".`,
      );
    }

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { githubRepoId: String(repo.id), githubRepoFullName: repo.fullName },
    });

    this.logger.log(`Workspace ${workspaceId} vinculado ao repo ${repo.fullName}.`);
    return workspace;
  }

  // --------------------------------------------------------------------------
  //  MEMBROS
  // --------------------------------------------------------------------------

  async inviteMember(userId: string, workspaceId: string, dto: InviteMemberDto) {
    await this.assertMembership(userId, workspaceId, [MemberRole.OWNER, MemberRole.ADMIN]);

    if (dto.role === MemberRole.OWNER) {
      throw new BadRequestException('Não é possível convidar alguém como OWNER.');
    }

    // O convidado precisa já ter logado na plataforma ao menos uma vez
    // (é o OAuth que cria o registro dele). Sem isso não temos o githubId.
    const invitee = await this.prisma.user.findFirst({
      where: { githubLogin: { equals: dto.githubLogin, mode: 'insensitive' } },
    });
    if (!invitee) {
      throw new NotFoundException(
        `Usuário "${dto.githubLogin}" não encontrado. Ele precisa fazer login na plataforma antes de ser convidado.`,
      );
    }

    try {
      return await this.prisma.workspaceMember.create({
        data: {
          userId: invitee.id,
          workspaceId,
          role: dto.role ?? MemberRole.MEMBER,
        },
        include: {
          user: { select: { id: true, name: true, githubLogin: true, avatarUrl: true } },
        },
      });
    } catch (err: any) {
      // P2002 = violação de unique (userId + workspaceId): já é membro.
      if (err?.code === 'P2002') {
        throw new ConflictException(`"${dto.githubLogin}" já é membro deste workspace.`);
      }
      throw err;
    }
  }

  async removeMember(userId: string, workspaceId: string, memberUserId: string): Promise<void> {
    await this.assertMembership(userId, workspaceId, [MemberRole.OWNER, MemberRole.ADMIN]);

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: memberUserId, workspaceId } },
    });
    if (!membership) throw new NotFoundException('Membro não encontrado neste workspace.');
    if (membership.role === MemberRole.OWNER) {
      throw new ForbiddenException('O dono do workspace não pode ser removido.');
    }

    await this.prisma.workspaceMember.delete({ where: { id: membership.id } });
  }

  // --------------------------------------------------------------------------
  //  REMOÇÃO
  // --------------------------------------------------------------------------

  async remove(userId: string, workspaceId: string): Promise<void> {
    await this.assertMembership(userId, workspaceId, [MemberRole.OWNER]);
    // onDelete: Cascade no schema cuida de members e tasks.
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    this.logger.log(`Workspace ${workspaceId} removido por ${userId}.`);
  }

  // --------------------------------------------------------------------------
  //  HELPERS
  // --------------------------------------------------------------------------

  /**
   * Garante que o usuário é membro do workspace (e, se `roles` vier,
   * que possui um dos papéis exigidos). Lança 404/403 caso contrário.
   *
   * 404 para não-membro (e não 403) é intencional: não revelamos a um
   * estranho que o workspace sequer existe.
   */
  private async assertMembership(userId: string, workspaceId: string, roles?: MemberRole[]) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) throw new NotFoundException('Workspace não encontrado.');
    if (roles && !roles.includes(membership.role)) {
      throw new ForbiddenException('Você não tem permissão para esta ação.');
    }
    return membership;
  }

  /** Busca o repo no GitHub usando o token do PRÓPRIO usuário. */
  private async resolveRepo(userId: string, repoFullName: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.githubAccessToken) {
      throw new BadRequestException('Seu token do GitHub não está disponível. Refaça o login.');
    }
    return this.githubApi.getRepo(user.githubAccessToken, repoFullName);
  }

  /**
   * Gera um slug URL-friendly a partir do nome ("Acme Eng" -> "acme-eng").
   * Se já existir, acrescenta um sufixo numérico ("acme-eng-2", "acme-eng-3"...).
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // remove acentos (marcas combinantes do NFD)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'workspace';

    let slug = base;
    for (let i = 2; ; i++) {
      const exists = await this.prisma.workspace.findUnique({ where: { slug } });
      if (!exists) return slug;
      slug = `${base}-${i}`;
    }
  }
}
