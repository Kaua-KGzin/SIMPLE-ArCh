import { IsEmail, IsString, MaxLength } from 'class-validator';

/** DTO de login por email/senha. */
export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(72)
  password!: string;
}
