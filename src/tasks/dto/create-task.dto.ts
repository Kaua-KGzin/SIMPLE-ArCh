import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TaskPriority } from '@prisma/client';

/**
 * DTO de entrada para criar uma Task.
 * O ValidationPipe global valida estes campos automaticamente e rejeita
 * requisições mal formadas ANTES de chegarem ao service (fail-fast).
 */
export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  // ISO 8601 (ex.: "2026-07-31" ou datetime completo). null/omitido = sem prazo.
  @IsISO8601()
  @IsOptional()
  dueDate?: string;

  // IDs de labels a vincular na criação (devem pertencer ao mesmo workspace).
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  labelIds?: string[];
}
