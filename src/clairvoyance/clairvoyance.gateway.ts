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
import { ClairvoyanceService, CodeIntent } from './clairvoyance.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/clairvoyance',
})
export class ClairvoyanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ClairvoyanceGateway.name);

  constructor(private readonly clairvoyanceService: ClairvoyanceService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.clairvoyanceService.removeSocketGlobally(client.id);
  }

  @SubscribeMessage('joinWorkspace')
  handleJoinWorkspace(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `workspace_${data.workspaceId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    return { event: 'joined', room };
  }

  @SubscribeMessage('reportIntent')
  handleReportIntent(
    @MessageBody() data: { workspaceId: string; intent: Omit<CodeIntent, 'timestamp'> },
    @ConnectedSocket() client: Socket,
  ) {
    const fullIntent: CodeIntent = { ...data.intent, timestamp: Date.now() };
    
    // 1. Armazena a intenção atual
    this.clairvoyanceService.addIntent(data.workspaceId, client.id, fullIntent);

    // 2. Busca se já existe alguém editando o mesmo local (Conflito!)
    const conflicts = this.clairvoyanceService.findConflicts(data.workspaceId, fullIntent, client.id);
    
    const room = `workspace_${data.workspaceId}`;

    if (conflicts.length > 0) {
      this.logger.warn(`Conflict detected in ${data.workspaceId} at ${fullIntent.astNode}! Notifying clients...`);
      
      // Avisa quem enviou a intenção (Client B)
      client.emit('conflictWarning', {
        message: 'Atenção: Há colegas editando este mesmo bloco de código agora!',
        conflictingIntents: conflicts,
      });

      // Avisa os outros clientes envolvidos (Client A) que alguém acabou de colidir com eles
      // Usamos broadcast.to(room) filtrando ou apenas mandando um evento geral para a sala informando a colisão.
      // Para ser cirúrgico, enviaríamos pelo socketId exato. Para MVP, mandaremos pro room.
      client.to(room).emit('conflictAlert', {
        message: 'Atenção: Um colega começou a editar o mesmo bloco de código que você!',
        newIntent: fullIntent,
      });
    }
  }

  @SubscribeMessage('clearIntent')
  handleClearIntent(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.clairvoyanceService.removeIntent(data.workspaceId, client.id);
  }
}
