import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module';

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

  // Valida e sanitiza DTOs automaticamente; remove campos não declarados.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
