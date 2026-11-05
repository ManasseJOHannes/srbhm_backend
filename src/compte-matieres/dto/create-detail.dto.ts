import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateDetailDto {
  @IsInt()
  @Min(1)
  articleId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixUnitaire: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  folioGrandLivre?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  existantDebut: number;

  @IsOptional()
  @IsString()
  observation?: string;
}
