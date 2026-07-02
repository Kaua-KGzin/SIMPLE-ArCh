import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** DTO de cadastro por email/senha (alternativa ao login via GitHub). */
export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Mínimo 8 chars: barra de entrada básica contra senhas triviais.
  // O hash (bcrypt) é quem garante a segurança de fato — isto é só UX.
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt ignora bytes além de 72 — truncar cedo evita confusão.
  password!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
