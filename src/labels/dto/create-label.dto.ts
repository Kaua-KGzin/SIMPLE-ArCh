import { IsHexColor, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** DTO para criar uma etiqueta no workspace. Cor em hex (ex.: "#ef4444"). */
export class CreateLabelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;

  @IsHexColor()
  color!: string;
}
