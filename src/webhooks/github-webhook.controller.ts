import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { GithubWebhookService } from './github-webhook.service';

/**
 * GithubWebhookController — recebe POST /api/webhooks/github.
 *
 * Ordem importa, por segurança:
 *   1) Valida a assinatura HMAC (usando o corpo RAW).
 *   2) Só então confia no payload e despacha para o serviço.
 *
 * Respondemos 2xx rápido para o GitHub não reentregar; o tratamento de erros
 * de negócio fica encapsulado e logado, sem vazar 500 desnecessário.
 */
@Controller('api/webhooks/github')
export class GithubWebhookController {
  private readonly logger = new Logger(GithubWebhookController.name);

  constructor(private readonly webhookService: GithubWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // 202: "recebi e vou processar"
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-github-event') eventType: string,
    @Headers('x-hub-signature-256') signature: string,
  ): Promise<{ received: true }> {
    // O rawBody é capturado pelo bodyParser configurado no main.ts.
    if (!req.rawBody) {
      throw new BadRequestException('rawBody indisponível (verifique a config do parser).');
    }

    if (!this.webhookService.verifySignature(req.rawBody, signature)) {
      throw new UnauthorizedException('Assinatura do webhook inválida.');
    }

    try {
      await this.webhookService.handleEvent(eventType, req.body);
    } catch (err) {
      // Logamos, mas devolvemos 202: já validamos a origem. Reprocessar via fila
      // é melhor que pedir reentrega ao GitHub num erro de negócio transitório.
      this.logger.error(`Erro processando evento "${eventType}"`, err as Error);
    }

    return { received: true };
  }
}
