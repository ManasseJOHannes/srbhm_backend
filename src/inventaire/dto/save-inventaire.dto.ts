import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsDecimal,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveLigneInventaireDto {
  @IsInt()
  @Min(1)
  articleId!: number;

  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  prixUnitaire!: string;

  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  quantitePhysique!: string;
}

export class SaveInventaireDto {
  @IsDateString()
  dateInventaire!: string;



  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => SaveLigneInventaireDto)
  lignes!: SaveLigneInventaireDto[];
}
