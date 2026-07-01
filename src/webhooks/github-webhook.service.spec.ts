import * as crypto from 'crypto';
import { GithubWebhookService } from './github-webhook.service';

describe('GithubWebhookService.verifySignature', () => {
  // Não usamos o banco aqui, então um stub vazio de PrismaService basta.
  const service = new GithubWebhookService({} as never);
  const secret = 'segredo-webhook-de-teste';

  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;
  });

  function sign(body: Buffer): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  it('aceita assinatura válida', () => {
    const body = Buffer.from(JSON.stringify({ action: 'opened' }));
    expect(service.verifySignature(body, sign(body))).toBe(true);
  });

  it('rejeita assinatura inválida', () => {
    const body = Buffer.from('{"action":"opened"}');
    expect(service.verifySignature(body, 'sha256=deadbeef')).toBe(false);
  });

  it('rejeita quando o header está ausente', () => {
    const body = Buffer.from('{}');
    expect(service.verifySignature(body, undefined)).toBe(false);
  });

  it('rejeita se o corpo foi alterado após assinar', () => {
    const original = Buffer.from('{"a":1}');
    const signature = sign(original);
    const adulterado = Buffer.from('{"a":2}');
    expect(service.verifySignature(adulterado, signature)).toBe(false);
  });
});
