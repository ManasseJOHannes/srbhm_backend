import { IsInt, IsNotEmpty, IsString, Length, Min } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  designation: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  unite: string;

  @IsInt()
  @Min(1)
  nomenclatureId: number;
}
