import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { GithubOAuthService } from './github-oauth.service';

/**
 * AuthController — a camada HTTP (fina). Só cuida de request/response e
 * delega a regra de negócio para o GithubOAuthService.
 */
@Controller('auth/github')
export class AuthController {
  constructor(private readonly oauth: GithubOAuthService) {}

  /**
   * Passo 1: inicia o login. Gera um `state` anti-CSRF, guarda num cookie
   * httpOnly e redireciona o usuário para a tela de autorização do GitHub.
   */
  @Get('login')
  login(@Res() res: Response): void {
    const state = crypto.randomBytes(16).toString('hex');

    // Cookie httpOnly: o JS do navegador não consegue ler → reduz superfície de ataque.
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 min
    });

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: process.env.GITHUB_CALLBACK_URL!,
      scope: 'read:user user:email repo',
      state,
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  }

  /**
   * Passo 3: o GitHub redireciona de volta para cá com `code` e `state`.
   * Validamos o `state` (anti-CSRF) ANTES de qualquer troca de token.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!code) throw new BadRequestException('Parâmetro "code" ausente.');

    const expectedState = req.cookies?.['oauth_state'];
    if (!expectedState || expectedState !== state) {
      throw new UnauthorizedException('State inválido — possível tentativa de CSRF.');
    }
    res.clearCookie('oauth_state'); // state é de uso único

    const { accessToken } = await this.oauth.authenticate(code);

    // Entrega o NOSSO JWT. Em produção, prefira cookie httpOnly a query string.
    const frontend = process.env.FRONTEND_URL!;
    res.redirect(`${frontend}/auth/success?token=${accessToken}`);
  }
}
