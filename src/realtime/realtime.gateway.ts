import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

/**
 * RealtimeGateway — canal WebSocket da plataforma.
 *
 * Duas "salas" por conexão:
 *  - `user:<id>`      — entra automaticamente ao conectar; usada para notificações pessoais.
 *  - `workspace:<id>` — entra sob demanda (evento `workspace:join`), só se for membro;
 *                       usada para board/comentários/atividade em tempo real.
 *
 * Autenticação: o mesmo JWT usado no REST (`Authorization: Bearer`) é passado em
 * `socket.handshake.auth.token` na conexão — sem isso, sem cookie httpOnly a validar aqui.
 */
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('sem token');
      const payload = this.jwt.verify<{ sub: string }>(token);
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('workspace:join')
  async onWorkspaceJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() workspaceId: string,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId || !workspaceId) return;
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (membership) await client.join(`workspace:${workspaceId}`);
  }

  @SubscribeMessage('workspace:leave')
  async onWorkspaceLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() workspaceId: string,
  ): Promise<void> {
    if (workspaceId) await client.leave(`workspace:${workspaceId}`);
  }

  /** Notificação pessoal (menção, atribuição...). */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  /** Board, comentários e feed de atividade do workspace. */
  emitToWorkspace(workspaceId: string, event: string, payload: unknown): void {
    this.server?.to(`workspace:${workspaceId}`).emit(event, payload);
  }
}
