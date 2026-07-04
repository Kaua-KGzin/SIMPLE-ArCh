import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

/**
 * Garante que a revogação por tokenVersion funciona: um JWT com versão antiga
 * (após "sair de todos os dispositivos") deixa de validar.
 */
describe('JwtStrategy.validate', () => {
  process.env.JWT_SECRET = 'test-secret';

  function strategyWith(user: unknown) {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    return new JwtStrategy(prisma as never);
  }

  it('aceita quando a versão do token bate com a do usuário', async () => {
    const strategy = strategyWith({ id: 'u1', githubLogin: null, email: 'a@b.c', tokenVersion: 2 });
    await expect(strategy.validate({ sub: 'u1', tv: 2 })).resolves.toEqual({
      id: 'u1',
      githubLogin: null,
      email: 'a@b.c',
    });
  });

  it('rejeita quando a versão do token é antiga (sessão revogada)', async () => {
    const strategy = strategyWith({ id: 'u1', githubLogin: null, email: 'a@b.c', tokenVersion: 3 });
    await expect(strategy.validate({ sub: 'u1', tv: 2 })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('trata token sem tv (legado) como versão 0 — válido se ninguém revogou', async () => {
    const strategy = strategyWith({ id: 'u1', githubLogin: null, email: 'a@b.c', tokenVersion: 0 });
    await expect(strategy.validate({ sub: 'u1' })).resolves.toMatchObject({ id: 'u1' });
  });

  it('rejeita quando o usuário não existe', async () => {
    const strategy = strategyWith(null);
    await expect(strategy.validate({ sub: 'x', tv: 0 })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
