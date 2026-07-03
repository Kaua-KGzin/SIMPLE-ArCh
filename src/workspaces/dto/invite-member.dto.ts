import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MemberRole } from '@prisma/client';

/**
 * DTO para convidar um membro.
 *
 * `identifier` aceita e-mail OU login do GitHub — desde o login local,
 * nem todo usuário tem githubLogin. `githubLogin` continua aceito por
 * compatibilidade com clientes antigos (o service trata os dois).
 */
export class InviteMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  identifier?: string;

  /** @deprecated use `identifier` — mantido por compatibilidade. */
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  githubLogin?: string;

  /** Papel do convidado. OWNER não é permitido — só existe um dono, o criador. */
  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole;
}
