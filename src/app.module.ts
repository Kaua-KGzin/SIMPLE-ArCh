import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { HealthController } from './common/health.controller';
import { SentryExceptionFilter } from './common/sentry-exception.filter';
import { AuthController } from './auth/auth.controller';
import { GithubOAuthService } from './auth/github-oauth.service';
import { LocalAuthController } from './auth/local-auth.controller';
import { LocalAuthService } from './auth/local-auth.service';
import { GithubWebhookController } from './webhooks/github-webhook.controller';
import { GithubWebhookService } from './webhooks/github-webhook.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks/tasks.service';
import { GithubApiService } from './tasks/github-api.service';
import { WorkspacesController } from './workspaces/workspaces.controller';
import { WorkspacesService } from './workspaces/workspaces.service';
import { WorkspaceMembershipGuard } from './workspaces/workspace-membership.guard';
import { ActivityService } from './activity/activity.service';
import { CommentsController } from './comments/comments.controller';
import { CommentsService } from './comments/comments.service';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { LabelsController } from './labels/labels.controller';
import { LabelsService } from './labels/labels.service';
import { ChecklistController } from './checklist/checklist.controller';
import { ChecklistService } from './checklist/checklist.service';

/**
 * Módulo raiz. Aqui o container de Injeção de Dependência do Nest é montado:
 * declaramos os "providers" (serviços injetáveis) e os "controllers" (rotas).
 *
 * Marcamos PrismaService como @Global indiretamente exportando-o, para não
 * precisar reimportar em cada módulo (num projeto maior, vire um PrismaModule).
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carrega .env globalmente
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    // Limite padrão generoso (não afeta uso normal da API); as rotas de
    // login/registro apertam esse limite via @Throttle — ver LocalAuthController.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [
    AuthController,
    LocalAuthController,
    GithubWebhookController,
    TasksController,
    WorkspacesController,
    CommentsController,
    NotificationsController,
    LabelsController,
    ChecklistController,
    HealthController,
  ],
  providers: [
    PrismaService,
    GithubOAuthService,
    LocalAuthService,
    JwtStrategy,
    GithubWebhookService,
    TasksService,
    GithubApiService,
    WorkspacesService,
    WorkspaceMembershipGuard,
    ActivityService,
    CommentsService,
    RealtimeGateway,
    NotificationsService,
    LabelsService,
    ChecklistService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Reporta exceções 5xx ao Sentry sem mudar o formato de resposta de erro.
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
  ],
  exports: [PrismaService],
})
export class AppModule {}
