import { ClairvoyanceGateway } from './clairvoyance.gateway';
import { ClairvoyanceService } from './clairvoyance.service';

/**
 * O gateway nasceu aberto: origin '*', sem JWT, qualquer um entrava na sala de
 * qualquer workspace, lia em quem/qual bloco de código os colegas editavam e
 * podia publicar intenções em nome de outra pessoa. Estes testes travam isso.
 */

type FakeSocket = ReturnType<typeof fakeSocket>;

function fakeSocket(token?: string) {
  const roomEmit = jest.fn();
  return {
    id: `sock-${Math.random().toString(36).slice(2)}`,
    handshake: { auth: token ? { token } : {} },
    data: {} as Record<string, unknown>,
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    to: jest.fn(() => ({ emit: roomEmit })),
    roomEmit,
  };
}

function setup() {
  const service = new ClairvoyanceService();
  const jwt = {
    verify: jest.fn((token: string) => {
      if (token === 'good-alice') return { sub: 'alice' };
      if (token === 'good-bob') return { sub: 'bob' };
      throw new Error('invalid signature');
    }),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve({ githubLogin: where.id === 'alice' ? 'alice-gh' : null }),
      ),
    },
    workspaceMember: {
      findUnique: jest.fn(({ where }: { where: { userId_workspaceId: { userId: string; workspaceId: string } } }) =>
        Promise.resolve(where.userId_workspaceId.workspaceId === 'ws-1' ? { id: 'm1' } : null),
      ),
    },
  };
  const gateway = new ClairvoyanceGateway(service, jwt as never, prisma as never);
  return { gateway, service, jwt, prisma };
}

const intent = (overrides: Record<string, unknown> = {}) => ({
  userId: 'mallory',
  githubLogin: 'mallory-gh',
  branch: 'main',
  filePathHash: 'abc123',
  astNode: 'AuthService.login',
  ...overrides,
});

async function connected(gateway: ClairvoyanceGateway, token: string): Promise<FakeSocket> {
  const socket = fakeSocket(token);
  await gateway.handleConnection(socket as never);
  return socket;
}

describe('ClairvoyanceGateway', () => {
  it('desconecta quem chega sem token', async () => {
    const { gateway } = setup();
    const socket = fakeSocket();
    await gateway.handleConnection(socket as never);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('desconecta quem chega com token inválido', async () => {
    const { gateway } = setup();
    const socket = fakeSocket('forged');
    await gateway.handleConnection(socket as never);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('autentica e guarda a identidade vinda do banco', async () => {
    const { gateway } = setup();
    const socket = await connected(gateway, 'good-alice');
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.data).toMatchObject({ userId: 'alice', githubLogin: 'alice-gh' });
  });

  it('não entra na sala de um workspace do qual não é membro', async () => {
    const { gateway } = setup();
    const socket = await connected(gateway, 'good-alice');
    await gateway.handleJoinWorkspace({ workspaceId: 'ws-other' }, socket as never);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('entra na sala do workspace quando é membro', async () => {
    const { gateway } = setup();
    const socket = await connected(gateway, 'good-alice');
    await gateway.handleJoinWorkspace({ workspaceId: 'ws-1' }, socket as never);
    expect(socket.join).toHaveBeenCalledWith('workspace_ws-1');
  });

  it('ignora intenções para um workspace em que o socket não entrou', async () => {
    const { gateway, service } = setup();
    const socket = await connected(gateway, 'good-alice');
    const add = jest.spyOn(service, 'addIntent');
    gateway.handleReportIntent({ workspaceId: 'ws-1', intent: intent() } as never, socket as never);
    gateway.handleReportIntent({ workspaceId: 'ws-x', intent: intent() } as never, socket as never);
    expect(add).not.toHaveBeenCalled();
  });

  it('a identidade da intenção é a do token, não a que o cliente manda', async () => {
    const { gateway, service } = setup();
    const socket = await connected(gateway, 'good-alice');
    await gateway.handleJoinWorkspace({ workspaceId: 'ws-1' }, socket as never);
    const add = jest.spyOn(service, 'addIntent');

    gateway.handleReportIntent({ workspaceId: 'ws-1', intent: intent() } as never, socket as never);

    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][2]).toMatchObject({ userId: 'alice', githubLogin: 'alice-gh' });
  });

  it.each([
    [{ filePathHash: 123 }],
    [{ astNode: 'x'.repeat(1000) }],
    [{ branch: undefined }],
  ])('rejeita intenção malformada %j', async (bad) => {
    const { gateway, service } = setup();
    const socket = await connected(gateway, 'good-alice');
    await gateway.handleJoinWorkspace({ workspaceId: 'ws-1' }, socket as never);
    const add = jest.spyOn(service, 'addIntent');

    gateway.handleReportIntent({ workspaceId: 'ws-1', intent: intent(bad) } as never, socket as never);
    gateway.handleReportIntent(undefined as never, socket as never);

    expect(add).not.toHaveBeenCalled();
  });

  it('avisa os dois lados quando dois membros editam o mesmo bloco', async () => {
    const { gateway } = setup();
    const alice = await connected(gateway, 'good-alice');
    const bob = await connected(gateway, 'good-bob');
    for (const s of [alice, bob]) await gateway.handleJoinWorkspace({ workspaceId: 'ws-1' }, s as never);

    gateway.handleReportIntent({ workspaceId: 'ws-1', intent: intent() } as never, alice as never);
    gateway.handleReportIntent({ workspaceId: 'ws-1', intent: intent() } as never, bob as never);

    expect(bob.emit).toHaveBeenCalledWith('conflictWarning', expect.anything());
    expect(bob.to).toHaveBeenCalledWith('workspace_ws-1');
    expect(bob.roomEmit).toHaveBeenCalledWith('conflictAlert', expect.anything());
  });
});
