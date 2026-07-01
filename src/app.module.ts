import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from './prisma/prisma.service';
import { AuthController } from './auth/auth.controller';
import { GithubOAuthService } from './auth/github-oauth.service';
import { GithubWebhookController } from './webhooks/github-webhook.controller';
import { GithubWebhookService } from './webhooks/github-webhook.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks/tasks.service';
import { GithubApiService } from './tasks/github-api.service';
import { WorkspacesController } from './workspaces/workspaces.controller';
import { WorkspacesService } from './workspaces/workspaces.service';

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
  ],
  controllers: [
    AuthController,
    GithubWebhookController,
    TasksController,
    WorkspacesController,
  ],
  providers: [
    PrismaService,
    GithubOAuthService,
    JwtStrategy,
    GithubWebhookService,
    TasksService,
    GithubApiService,
    WorkspacesService,
  ],
  exports: [PrismaService],
})
export class AppModule {}
