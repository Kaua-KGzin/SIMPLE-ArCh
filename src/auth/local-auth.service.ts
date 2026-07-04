import { ConflictException, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Custo do bcrypt: 12 rounds é o piso recomendado atual (~250ms/hash em
// hardware comum) — alto o bastante pra encarecer força bruta offline,
// baixo o bastante pra não travar a requisição.
const BCRYPT_COST = 12;

// Hash "morto" usado quando o e-mail não existe, só para o bcrypt.compare()
// consumir um tempo parecido com o caso de senha errada — dificulta usar o
// tempo de resposta do login para descobrir quais e-mails têm conta.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeOMdiO4rjxYQ0h5eKcbjWNxb0Bj8LqTQi';

/**
 * LocalAuthService — cadastro/login por e-mail e senha.
 *
 * Alternativa ao GithubOAuthService: mesmo formato de JWT (mesmo
 * JwtService, mesmo payload `{ sub, githubLogin }`), então o resto da
 * aplicação (JwtStrategy, guards) não precisa saber qual foi o método de
 * login usado.
 */
@Injectable()
export class LocalAuthService {
  private readonly logger = new Logger(LocalAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Este e-mail já está cadastrado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.prisma.user.create({
      data: { email, name: dto.name, passwordHash },
    });

    this.logger.log(`Usuário registrado por e-mail: ${user.id}`);
    return this.issueToken(user.id, user.githubLogin, user.tokenVersion);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Compara contra um hash válido mesmo se o usuário não existir (ou não
    // tiver senha local, ex.: conta criada via GitHub) — mesma mensagem de
    // erro e tempo de resposta parecido nos dois casos, sem revelar qual
    // deles é o motivo.
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const passwordOk = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !user.passwordHash || !passwordOk) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    return this.issueToken(user.id, user.githubLogin, user.tokenVersion);
  }

  /**
   * "Sair de todos os dispositivos": incrementa tokenVersion, o que faz TODOS
   * os JWTs já emitidos (inclusive o atual) deixarem de validar. Devolve um
   * token novo, já com a versão atualizada, para a sessão que pediu continuar.
   */
  async revokeAllSessions(userId: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    this.logger.log(`Sessões revogadas para ${userId} (tokenVersion=${user.tokenVersion}).`);
    return this.issueToken(user.id, user.githubLogin, user.tokenVersion);
  }

  private async issueToken(
    userId: string,
    githubLogin: string | null,
    tokenVersion: number,
  ): Promise<{ accessToken: string }> {
    const accessToken = await this.jwt.signAsync({ sub: userId, githubLogin, tv: tokenVersion });
    return { accessToken };
  }
}
