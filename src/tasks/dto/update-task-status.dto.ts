import { IsEnum } from 'class-validator';
import { TaskStatus } from '@prisma/client';

/** DTO para mover uma task entre colunas do board. */
export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}
