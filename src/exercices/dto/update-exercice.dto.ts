import { IsEnum } from 'class-validator';
import { StatutExercice } from '@prisma/client';

export class UpdateExerciceDto  {
    @IsEnum(StatutExercice)
    statut: StatutExercice;
}
