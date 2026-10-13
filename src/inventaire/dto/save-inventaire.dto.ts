import { IsArray, IsDateString, IsInt, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LigneInventaireDto {
  @IsInt()
  @Min(1)
  articleId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixUnitaire: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantitePhysique: number;
}

export class SaveInventaireDto {
  @IsDateString()
  dateInventaire: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LigneInventaireDto)
  lignes: LigneInventaireDto[];
}
