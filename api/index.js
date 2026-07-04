/**
 * Entrada serverless (Vercel) da API.
 *
 * Por que .js requerendo `dist/` em vez de importar `src/`? O bundler da
 * Vercel (esbuild) NÃO emite decorator metadata, que o container de DI do
 * Nest exige. Compilamos com tsc (`nest build`) no buildCommand e aqui só
 * montamos o app já compilado.
 *
 * A instância é criada UMA vez por cold start e reaproveitada entre
 * invocações (padrão para Express em serverless).
 */
// Antes de tudo: instrumenta o processo cedo (no-op sem SENTRY_DSN).
require('../dist/common/sentry').initSentry();

const express = require('express');
const cookieParser = require('cookie-parser');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { AppModule } = require('../dist/app.module');
const { resolveAllowedOrigins } = require('../dist/common/cors.util');

const server = express();
// Mesmo motivo do src/main.ts: sem isto, o rate limit por IP (@Throttle no
// login) vê o IP do proxy da Vercel em toda requisição, não o do cliente.
server.set('trust proxy', 1);
let ready = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
  });

  // Mesmo setup do src/main.ts: rawBody preservado p/ validar HMAC dos webhooks.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());
  // Falha no boot se FRONTEND_URL não estiver definida (ver src/common/cors.util.ts).
  app.enableCors({ origin: resolveAllowedOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();
}

module.exports = async (req, res) => {
  if (!ready) ready = bootstrap();
  await ready;
  return server(req, res);
};
