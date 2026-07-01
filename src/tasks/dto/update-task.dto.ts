import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * DTO para editar uma Task. Todos os campos são opcionais (edição parcial).
 * `assigneeId: null` explícito = desatribuir (por isso o ValidateIf: só
 * validamos como string quando NÃO for null).
 */
export class UpdateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @IsOptional()
  assigneeId?: string | null;
}
