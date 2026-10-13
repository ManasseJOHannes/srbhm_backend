import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TypeMouvement } from '@prisma/client';

export class CreateMouvementDto {
  @IsEnum(TypeMouvement)
  type: TypeMouvement;

  @IsDateString()
  date: string;

  @IsInt()
  @Min(1)
  exerciceId: number;

  @IsInt()
  @Min(1)
  articleId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantite: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixUnitaire: number;

  @IsOptional()
  @IsString()
  observation?: string;
}
