import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TaskPriority } from '@prisma/client';

/**
 * DTO para editar uma Task. Todos os campos são opcionais (edição parcial).
 * Campos que aceitam `null` explícito (desatribuir / remover prazo) usam
 * ValidateIf para só validar o tipo quando o valor NÃO for null.
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

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  // null = remover o prazo; string ISO = definir; undefined = não mexer.
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  @IsOptional()
  dueDate?: string | null;

  // Se enviado, SUBSTITUI o conjunto de labels da task (não é incremental).
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  labelIds?: string[];
}
