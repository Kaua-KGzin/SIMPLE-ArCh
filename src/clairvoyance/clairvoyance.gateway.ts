import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayDisconnect,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ClairvoyanceService, CodeIntent } from './clairvoyance.service';

const MAX_FIELD = 256;

/** Campos que o cliente pode mandar; identidade (userId/githubLogin) vem do token. */
type ReportedIntent = Pick<CodeIntent, 'branch' | 'filePathHash' | 'astNode'>;

function isShortString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_FIELD;
}

/**
 * Clairvoyance — avisa quando dois membros do mesmo workspace editam o mesmo bloco de código.
 *
 * Mesmo modelo do RealtimeGateway: JWT do REST em `handshake.auth.token`, e só
 * membros entram na sala do workspace. Antes o namespace aceitava qualquer origem
 * e qualquer cliente, que podia entrar em qualquer sala, ler o que os colegas
 * editavam e publicar intenções em nome de outro usuário — e cada workspaceId
 * inventado criava uma entrada nova no mapa em memória.
 */
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  namespace: '/clairvoyance',
})
export class ClairvoyanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ClairvoyanceGateway.name);

  constructor(
    private readonly clairvoyanceService: ClairvoyanceService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('sem token');
      const { sub } = this.jwt.verify<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({ where: { id: sub }, select: { githubLogin: true } });
      if (!user) throw new Error('usuário inexistente');
      client.data.userId = sub;
      client.data.githubLogin = user.githubLogin ?? '';
      client.data.workspaces = new Set<string>();
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.clairvoyanceService.removeSocketGlobally(client.id);
  }

  private joined(client: Socket, workspaceId: unknown): workspaceId is string {
    const workspaces = client.data.workspaces as Set<string> | undefined;
    return typeof workspaceId === 'string' && !!workspaces?.has(workspaceId);
  }

  @SubscribeMessage('joinWorkspace')
  async handleJoinWorkspace(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as string | undefined;
    const workspaceId = data?.workspaceId;
    if (!userId || !isShortString(workspaceId)) return { event: 'denied' };

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) return { event: 'denied' };

    const room = `workspace_${workspaceId}`;
    await client.join(room);
    (client.data.workspaces as Set<string>).add(workspaceId);
    return { event: 'joined', room };
  }

  @SubscribeMessage('reportIntent')
  handleReportIntent(
    @MessageBody() data: { workspaceId: string; intent: ReportedIntent },
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.joined(client, data?.workspaceId)) return;
    const reported = data.intent;
    if (!reported || ![reported.branch, reported.filePathHash, reported.astNode].every(isShortString)) return;

    const fullIntent: CodeIntent = {
      branch: reported.branch,
      filePathHash: reported.filePathHash,
      astNode: reported.astNode,
      userId: client.data.userId as string,
      githubLogin: client.data.githubLogin as string,
      timestamp: Date.now(),
    };
    const { workspaceId } = data;

    this.clairvoyanceService.addIntent(workspaceId, client.id, fullIntent);
    const conflicts = this.clairvoyanceService.findConflicts(workspaceId, fullIntent, client.id);
    if (conflicts.length === 0) return;

    this.logger.debug(`Conflito em ${workspaceId} no bloco ${fullIntent.astNode}`);
    client.emit('conflictWarning', {
      message: 'Atenção: Há colegas editando este mesmo bloco de código agora!',
      conflictingIntents: conflicts,
    });
    client.to(`workspace_${workspaceId}`).emit('conflictAlert', {
      message: 'Atenção: Um colega começou a editar o mesmo bloco de código que você!',
      newIntent: fullIntent,
    });
  }

  @SubscribeMessage('clearIntent')
  handleClearIntent(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.joined(client, data?.workspaceId)) return;
    this.clairvoyanceService.removeIntent(data.workspaceId, client.id);
  }
}
