import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CryptoUtil } from '../common/crypto.util';

/**
 * GithubApiService — encapsula chamadas à REST API do GitHub feitas EM NOME do usuário.
 *
 * POR QUÊ isolar isto? Single Responsibility: o TasksService cuida da regra de
 * negócio (criar Task); este serviço cuida do "como falar com o GitHub". Se a
 * API mudar, só este arquivo muda.
 *
 * O token chega CRIPTOGRAFADO do banco; descriptografamos só na hora de usar,
 * mantendo o texto puro o menor tempo possível em memória.
 */
@Injectable()
export class GithubApiService {
  private readonly logger = new Logger(GithubApiService.name);
  private readonly baseUrl = 'https://api.github.com';

  /**
   * Cria uma Issue no repositório informado.
   * @param encryptedToken  token OAuth do usuário, como está no banco (cifrado).
   * @param repoFullName    "owner/repo".
   * @returns número e id da Issue criada.
   */
  async createIssue(
    encryptedToken: string,
    repoFullName: string,
    title: string,
    body?: string,
  ): Promise<{ number: number; id: number }> {
    const token = CryptoUtil.decrypt(encryptedToken);

    const res = await fetch(`${this.baseUrl}/repos/${repoFullName}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body }),
    });

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Falha ao criar Issue em ${repoFullName}: ${res.status} ${detail}`);
      throw new InternalServerErrorException('Não foi possível criar a Issue no GitHub.');
    }

    const issue = (await res.json()) as { number: number; id: number };
    this.logger.log(`Issue #${issue.number} criada em ${repoFullName}.`);
    return { number: issue.number, id: issue.id };
  }

  /**
   * Busca os metadados de um repositório ("owner/repo") em nome do usuário.
   *
   * Usado ao vincular um repo a um Workspace: o usuário informa só o nome
   * amigável e nós resolvemos o `id` numérico (imutável) via API. Também serve
   * de validação: se o token do usuário não enxerga o repo (não existe ou é
   * privado sem acesso), o GitHub devolve 404 e barramos o vínculo aqui.
   */
  async getRepo(
    encryptedToken: string,
    repoFullName: string,
  ): Promise<{ id: number; fullName: string; private: boolean }> {
    const token = CryptoUtil.decrypt(encryptedToken);

    const res = await fetch(`${this.baseUrl}/repos/${repoFullName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (res.status === 404) {
      throw new NotFoundException(
        `Repositório "${repoFullName}" não encontrado ou sem acesso com o seu token.`,
      );
    }
    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Falha ao buscar repo ${repoFullName}: ${res.status} ${detail}`);
      throw new InternalServerErrorException('Não foi possível consultar o repositório no GitHub.');
    }

    const repo = (await res.json()) as { id: number; full_name: string; private: boolean };
    return { id: repo.id, fullName: repo.full_name, private: repo.private };
  }
}
