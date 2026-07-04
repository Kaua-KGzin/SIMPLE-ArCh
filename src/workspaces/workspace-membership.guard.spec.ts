import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { WorkspaceMembershipGuard } from './workspace-membership.guard';

/**
 * Cobre a classe de bug encontrada na auditoria: as rotas de Task não
 * checavam membership nenhuma, então qualquer conta autenticada conseguia
 * agir sobre workspaces alheios. Este guard é o que fecha o buraco — este
 * teste garante que ele continua fechado.
 */
describe('WorkspaceMembershipGuard', () => {
  function contextWith(params: Record<string, string>, user?: { id: string }): ExecutionContext {
    const request = { params, user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('permite quando o usuário é membro do workspace da rota', async () => {
    const prisma = {
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', role: 'MEMBER' }),
      },
    };
    const guard = new WorkspaceMembershipGuard(prisma as never);
    const ctx = contextWith({ workspaceId: 'w1' }, { id: 'u1' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: { userId_workspaceId: { userId: 'u1', workspaceId: 'w1' } },
    });
  });

  it('rejeita (404) um usuário autenticado que NÃO é membro do workspace', async () => {
    const prisma = { workspaceMember: { findUnique: jest.fn().mockResolvedValue(null) } };
    const guard = new WorkspaceMembershipGuard(prisma as never);
    const ctx = contextWith({ workspaceId: 'w-de-outra-equipe' }, { id: 'intruso' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita quando não há usuário autenticado no request', async () => {
    const prisma = { workspaceMember: { findUnique: jest.fn() } };
    const guard = new WorkspaceMembershipGuard(prisma as never);
    const ctx = contextWith({ workspaceId: 'w1' }, undefined);

    await expect(guard.canActivate(ctx)).resolves.toBe(false);
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it('rejeita quando a rota não tem :workspaceId', async () => {
    const prisma = { workspaceMember: { findUnique: jest.fn() } };
    const guard = new WorkspaceMembershipGuard(prisma as never);
    const ctx = contextWith({}, { id: 'u1' });

    await expect(guard.canActivate(ctx)).resolves.toBe(false);
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });
});
