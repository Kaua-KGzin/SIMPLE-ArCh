import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
