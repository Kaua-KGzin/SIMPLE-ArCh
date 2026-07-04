import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module';
import { resolveAllowedOrigins } from './common/cors.util';

/**
 * Bootstrap da aplicação.
 *
 * DETALHE CRÍTICO: precisamos do corpo RAW (bytes crus) das requisições para
 * validar a assinatura HMAC dos webhooks. Por isso registramos um `verify`
 * no body-parser que guarda o Buffer original em `req.rawBody`.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(
    json({
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf; // preserva o payload original para o HMAC
      },
    }),
  );

  app.use(cookieParser());

  // Atrás de um proxy (Vercel, load balancer), sem isto o Express vê o IP do
  // proxy em TODA requisição — o rate limit por IP (@Throttle no login)
  // vira um balde único compartilhado por todo mundo, em vez de por usuário.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // CORS: o frontend (Vite, porta 5173) é uma ORIGEM diferente da API (3000).
  // Falha no boot se FRONTEND_URL não estiver definida — não deixamos o
  // `cors` cair no padrão permissivo (reflete qualquer origem) por engano.
  app.enableCors({ origin: resolveAllowedOrigins(), credentials: true });

  // Valida e sanitiza DTOs automaticamente; remove campos não declarados.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
