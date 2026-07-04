import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

/**
 * JwtStrategy — valida O NOSSO JWT em rotas protegidas.
 *
 * Como funciona: o Passport extrai o token do header "Authorization: Bearer ...",
 * verifica a assinatura com o JWT_SECRET e, se válido, chama validate().
 * O retorno de validate() é anexado a `req.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: { sub: string; githubLogin?: string | null; tv?: number }) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado.');
    // Revogação: se a versão do token não bate com a do usuário, o JWT foi
    // invalidado ("sair de todos os dispositivos"). `?? 0` mantém tokens
    // antigos (sem o campo) válidos enquanto ninguém revogou.
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    // Nunca devolvemos o token do GitHub aqui — só o necessário.
    return { id: user.id, githubLogin: user.githubLogin, email: user.email };
  }
}
