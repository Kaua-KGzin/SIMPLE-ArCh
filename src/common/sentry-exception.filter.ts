import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Reporta ao Sentry só o que interessa: erros de servidor (5xx) e exceções
 * não-HTTP (bugs de verdade). Os 4xx — validação, não-autorizado, não-encontrado
 * — são fluxo normal e só poluiriam o painel, então passam direto.
 *
 * Estende BaseExceptionFilter para NÃO mudar o formato de resposta de erro do
 * Nest: depois de reportar, delega para o comportamento padrão. Se o Sentry não
 * foi inicializado (sem DSN), `captureException` é no-op — seguro em qualquer
 * ambiente.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}
