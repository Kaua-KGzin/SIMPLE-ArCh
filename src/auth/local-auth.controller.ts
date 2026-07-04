import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, AuthUser } from './current-user.decorator';
import { LocalAuthService } from './local-auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * LocalAuthController — cadastro/login por e-mail e senha.
 * Complementa (não substitui) o login via GitHub em `AuthController`.
 *
 * `@Throttle`: limita tentativas por IP — sem isso, /login vira um
 * endpoint de força bruta de senha de graça.
 */
@Controller('auth')
export class LocalAuthController {
  constructor(private readonly localAuth: LocalAuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto): Promise<{ accessToken: string }> {
    return this.localAuth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.localAuth.login(dto);
  }

  /**
   * Sair de todos os dispositivos: invalida todos os JWTs existentes e devolve
   * um token novo para esta sessão continuar. Serve para reagir a um token
   * possivelmente vazado sem esperar os 7 dias de expiração.
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logoutAll(@CurrentUser() user: AuthUser): Promise<{ accessToken: string }> {
    return this.localAuth.revokeAllSessions(user.id);
  }
}
