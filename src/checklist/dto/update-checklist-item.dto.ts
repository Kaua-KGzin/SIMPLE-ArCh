import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** DTO para editar um item do checklist (marcar/desmarcar ou renomear). */
export class UpdateChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @IsOptional()
  text?: string;

  @IsBoolean()
  @IsOptional()
  done?: boolean;
}
