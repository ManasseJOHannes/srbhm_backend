import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  
} from 'class-validator';
import { TypeMouvement } from '@prisma/client';

import { Type } from 'class-transformer';

export class CreateMouvementDto {
  @IsEnum(TypeMouvement)
  type: TypeMouvement;

  @IsDateString()
  date: string;

  @IsInt()
  @Min(1)
  articleId: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  lotStockId?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantite: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prixUnitaire: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observation?: string;
}