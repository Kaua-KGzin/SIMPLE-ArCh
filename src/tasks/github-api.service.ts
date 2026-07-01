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

  /** GET autenticado genérico na API do GitHub (reuso interno). */
  private async get<T>(encryptedToken: string, path: string): Promise<T> {
    const token = CryptoUtil.decrypt(encryptedToken);
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (res.status === 404) throw new NotFoundException('Recurso não encontrado no GitHub.');
    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Falha em GET ${path}: ${res.status} ${detail}`);
      throw new InternalServerErrorException('Falha ao consultar o GitHub.');
    }
    return res.json() as Promise<T>;
  }

  /**
   * "Código" de um PR: metadados (estado, +/-, arquivos) + diffs por arquivo.
   * O `patch` é o diff unificado que a UI colore linha a linha.
   */
  async getPullRequestCode(encryptedToken: string, repoFullName: string, prNumber: number) {
    const [pr, files] = await Promise.all([
      this.get<{
        title: string;
        state: string;
        merged: boolean;
        additions: number;
        deletions: number;
        changed_files: number;
        html_url: string;
        head: { ref: string };
        user: { login: string; avatar_url: string };
      }>(encryptedToken, `/repos/${repoFullName}/pulls/${prNumber}`),
      this.get<
        { filename: string; status: string; additions: number; deletions: number; patch?: string }[]
      >(encryptedToken, `/repos/${repoFullName}/pulls/${prNumber}/files?per_page=50`),
    ]);

    return {
      number: prNumber,
      title: pr.title,
      state: pr.merged ? 'merged' : pr.state,
      branch: pr.head.ref,
      author: { login: pr.user.login, avatarUrl: pr.user.avatar_url },
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      url: pr.html_url,
      files: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch ?? null, // binários/arquivos enormes vêm sem patch
      })),
    };
  }

  /** Atividade recente do repo: últimos commits e PRs (feed do workspace). */
  async getRepoActivity(encryptedToken: string, repoFullName: string) {
    const [commits, pulls] = await Promise.all([
      this.get<
        {
          sha: string;
          html_url: string;
          commit: { message: string; author: { name: string; date: string } };
          author: { login: string; avatar_url: string } | null;
        }[]
      >(encryptedToken, `/repos/${repoFullName}/commits?per_page=15`),
      this.get<
        {
          number: number;
          title: string;
          state: string;
          merged_at: string | null;
          html_url: string;
          created_at: string;
          user: { login: string; avatar_url: string };
        }[]
      >(encryptedToken, `/repos/${repoFullName}/pulls?state=all&sort=updated&direction=desc&per_page=10`),
    ]);

    return {
      commits: commits.map((c) => ({
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.author?.login ?? c.commit.author.name,
        avatarUrl: c.author?.avatar_url ?? null,
        date: c.commit.author.date,
        url: c.html_url,
      })),
      pulls: pulls.map((p) => ({
        number: p.number,
        title: p.title,
        state: p.merged_at ? 'merged' : p.state,
        author: p.user.login,
        avatarUrl: p.user.avatar_url,
        date: p.created_at,
        url: p.html_url,
      })),
    };
  }
}
