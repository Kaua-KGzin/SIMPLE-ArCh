import { GithubOAuthService } from './github-oauth.service';

/**
 * Testa a RESOLUÇÃO DE USUÁRIO do login GitHub — em especial a vinculação
 * com conta local pré-existente (mesmo e-mail), que antes quebrava com
 * P2002 (violação de unique em email).
 */
describe('GithubOAuthService.authenticate', () => {
  const ghUser = {
    id: 999,
    login: 'octo',
    name: 'Octo Cat',
    avatar_url: 'https://example.com/a.png',
    email: 'Pessoa@Example.com', // maiúsculas de propósito: precisa normalizar
  };

  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwt: { signAsync: jest.Mock };
  let service: GithubOAuthService;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '00'.repeat(32); // 32 bytes hex p/ CryptoUtil
    global.fetch = jest.fn(async (url: any) => {
      if (String(url).includes('login/oauth/access_token')) {
        return { ok: true, json: async () => ({ access_token: 'gh_tok', scope: 'repo' }) } as any;
      }
      return { ok: true, json: async () => ghUser } as any;
    }) as any;
  });

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(async (args: any) => ({ id: 'u1', githubLogin: 'octo', ...args.data })),
        create: jest.fn(async (args: any) => ({ id: 'u-novo', githubLogin: 'octo', ...args.data })),
      },
    };
    jwt = { signAsync: jest.fn(async () => 'jwt-assinado') };
    service = new GithubOAuthService(prisma as never, jwt as never);
  });

  it('vincula o GitHub a uma conta LOCAL existente com o mesmo e-mail (sem criar duplicata)', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // por githubId: não existe
      .mockResolvedValueOnce({ id: 'local-1', name: 'Nome Local', email: 'pessoa@example.com' });

    await service.authenticate('code');

    // Buscou por email NORMALIZADO (lowercase)
    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { email: 'pessoa@example.com' },
    });
    // Vinculou (update) em vez de criar duplicata
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'local-1' },
        data: expect.objectContaining({ githubId: '999', githubLogin: 'octo' }),
      }),
    );
    // Preserva o nome que a pessoa escolheu no cadastro local
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.name).toBe('Nome Local');
  });

  it('login repetido (match por githubId) só atualiza tokens', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', githubId: '999' });

    await service.authenticate('code');

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
  });

  it('cria usuário novo quando não há match por githubId nem por e-mail', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await service.authenticate('code');

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ githubId: '999', email: 'pessoa@example.com' }),
      }),
    );
  });
});
