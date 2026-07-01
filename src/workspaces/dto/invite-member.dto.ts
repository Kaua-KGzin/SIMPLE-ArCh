import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MemberRole } from '@prisma/client';

/**
 * DTO para convidar um membro pelo login do GitHub.
 *
 * POR QUÊ pelo login e não por e-mail? O login é o identificador natural aqui:
 * quem entra na plataforma se autentica via GitHub OAuth, então o usuário
 * convidado já existe (ou existirá) no nosso banco com esse login.
 */
export class InviteMemberDto {
  @IsString()
  @IsNotEmpty()
  githubLogin!: string;

  /** Papel do convidado. OWNER não é permitido — só existe um dono, o criador. */
  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole;
}
