import { IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { ETATS_MATIERE, type EtatMatiere } from '../etats-matiere.js';

export class UpsertLigneInventaireDto {
  @IsInt()
  @Min(1)
  articleId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixUnitaire: number;

  /**
   * Quantité constatée. Absente ou nulle : on conserve la valeur déjà
   * enregistrée, ou l'existant de référence pour une nouvelle ligne.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantiteConstatee?: number | null;

  /** Quantité trouvée en plus de l'existant. Null = rien à signaler. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantiteExcedent?: number | null;

  /** Quantité manquante. Null = rien à signaler. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantiteDeficit?: number | null;

  /** État physique optionnel, utilisé à la création d'un excédent. */
  @IsOptional()
  @IsIn([...ETATS_MATIERE])
  observationEtat?: EtatMatiere;
}
