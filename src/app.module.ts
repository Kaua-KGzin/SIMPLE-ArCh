import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
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
import { ActivityService } from './activity/activity.service';
import { CommentsController } from './comments/comments.controller';
import { CommentsService } from './comments/comments.service';

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
    ActivityService,
    CommentsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [PrismaService],
})
export class AppModule {}
