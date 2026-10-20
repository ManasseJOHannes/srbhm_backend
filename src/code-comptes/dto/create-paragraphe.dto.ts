import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateParagrapheDto {
  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'Le code compte doit contenir exactement 4 chiffres',
  })
  code: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  libelle: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  nomenclatureId?: number | null;
}
