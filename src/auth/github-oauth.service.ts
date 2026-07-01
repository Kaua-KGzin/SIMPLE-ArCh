import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoUtil } from '../common/crypto.util';

/**
 * Tipos mínimos das respostas do GitHub que nos interessam.
 * Tipar as respostas externas evita "any" e bugs silenciosos.
 */
interface GithubTokenResponse {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GithubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

/**
 * GithubOAuthService — orquestra a Etapa 2 (autenticação).
 *
 * Responsabilidades (Single Responsibility): trocar `code` por token,
 * descobrir quem é o usuário, persistir com o token CRIPTOGRAFADO e
 * devolver O NOSSO JWT. A camada HTTP (controller) não sabe desses detalhes.
 */
@Injectable()
export class GithubOAuthService {
  private readonly logger = new Logger(GithubOAuthService.name);

  // Injeção de dependência via construtor — o Nest resolve estas instâncias.
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Passo 4: troca o `code` temporário pelo access_token do usuário.
   * Esta chamada é server-to-server e usa o client_secret (jamais exposto).
   */
  private async exchangeCodeForToken(code: string): Promise<GithubTokenResponse> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    if (!res.ok) {
      throw new InternalServerErrorException('Falha ao contatar o GitHub para troca de token.');
    }

    const data = (await res.json()) as GithubTokenResponse;
    if (data.error || !data.access_token) {
      // Ex.: code expirado/reutilizado. Não é um 500 nosso → é credencial inválida.
      throw new UnauthorizedException(data.error_description ?? 'Code OAuth inválido.');
    }
    return data;
  }

  /** Passo 5: usa o token do GitHub para descobrir QUEM é o usuário. */
  private async fetchGithubUser(accessToken: string): Promise<GithubUserResponse> {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      throw new UnauthorizedException('Não foi possível obter o perfil do GitHub.');
    }
    return (await res.json()) as GithubUserResponse;
  }

  /**
   * Orquestra o fluxo completo e devolve o NOSSO JWT.
   * `upsert`: se já existe (match por githubId imutável), atualiza o token;
   * senão, cria. Idempotente — logar de novo não duplica usuários.
   */
  async authenticate(code: string): Promise<{ accessToken: string }> {
    const tokenData = await this.exchangeCodeForToken(code);
    const ghUser = await this.fetchGithubUser(tokenData.access_token!);

    const user = await this.prisma.user.upsert({
      where: { githubId: String(ghUser.id) },
      create: {
        githubId: String(ghUser.id),
        githubLogin: ghUser.login,
        email: ghUser.email ?? `${ghUser.login}@users.noreply.github.com`,
        name: ghUser.name,
        avatarUrl: ghUser.avatar_url,
        githubAccessToken: CryptoUtil.encrypt(tokenData.access_token!),
        githubRefreshToken: tokenData.refresh_token
          ? CryptoUtil.encrypt(tokenData.refresh_token)
          : null,
        githubTokenScope: tokenData.scope,
      },
      update: {
        githubLogin: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        githubAccessToken: CryptoUtil.encrypt(tokenData.access_token!),
        githubTokenScope: tokenData.scope,
      },
    });

    this.logger.log(`Usuário autenticado: ${user.githubLogin} (${user.id})`);

    // Passo 6: emitimos NOSSO JWT. O frontend nunca vê o token do GitHub.
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      githubLogin: user.githubLogin,
    });

    return { accessToken };
  }
}
