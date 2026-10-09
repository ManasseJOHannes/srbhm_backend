import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDetailCompteMatiereDto {
  @IsInt()
  @Min(1)
  articleId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  folioGrandLivre?: number;

  @IsNumber()
  @Min(0)
  prixUnitaire: number;

  @IsNumber()
  @Min(0)
  existantDebut: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observation?: string;
}