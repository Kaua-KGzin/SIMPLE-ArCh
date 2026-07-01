import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard — aplica a JwtStrategy nas rotas anotadas com @UseGuards(JwtAuthGuard).
 * Se o JWT for inválido/ausente, o Passport responde 401 automaticamente.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
