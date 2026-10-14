import { IsIn, IsInt, IsNotEmpty, IsString, Length, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export const UNITES_AUTORISEES = ['nb', 'l', 'kg'] as const;

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  designation: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsIn(UNITES_AUTORISEES as unknown as string[], {
    message: "L'unité doit être nb, l ou kg",
  })
  unite: string;

  @IsInt()
  @Min(1)
  nomenclatureId: number;
}
