import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** DTO para adicionar um item ao checklist de uma task. */
export class CreateChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  text!: string;
}
