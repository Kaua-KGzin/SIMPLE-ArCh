import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';

/**
 * WorkspaceMembershipGuard — barra o acesso de quem NÃO é membro do
 * workspace da rota (`:workspaceId`), mesmo estando autenticado.
 *
 * `JwtAuthGuard` só prova "existe uma sessão válida"; sem este guard,
 * qualquer conta autenticada poderia agir sobre workspaces alheios só por
 * conhecer o id (foi exatamente o buraco encontrado nas rotas de Task).
 * Use em conjunto: `@UseGuards(JwtAuthGuard, WorkspaceMembershipGuard)`.
 *
 * 404 (não 403) para não-membro: mesmo padrão já usado nos services, para
 * não revelar a um estranho que o workspace existe.
 */
@Injectable()
export class WorkspaceMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceId = request.params?.workspaceId as string | undefined;
    const user = request.user as AuthUser | undefined;

    if (!workspaceId || !user) return false;

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    });
    if (!membership) throw new NotFoundException('Workspace não encontrado.');

    request.workspaceMembership = membership;
    return true;
  }
}
