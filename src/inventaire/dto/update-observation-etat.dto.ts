import { IsIn, IsInt, Min } from 'class-validator';
import { ETATS_MATIERE, type EtatMatiere } from '../etats-matiere.js';

export class UpdateObservationEtatDto {
  @IsInt()
  @Min(1)
  detailId: number;

  @IsIn([...ETATS_MATIERE])
  observationEtat: EtatMatiere;
}
