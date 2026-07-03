import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** DTO de criação de comentário. @menções vão no próprio texto ("@nome"). */
export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;
}
