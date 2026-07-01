import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Formato do usuário autenticado (vem do retorno de JwtStrategy.validate). */
export interface AuthUser {
  id: string;
  githubLogin: string;
  email: string;
}

/**
 * @CurrentUser() — extrai o usuário autenticado de `req.user` de forma tipada,
 * evitando acessar `req.user` manualmente em cada controller.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
