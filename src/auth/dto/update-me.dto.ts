import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Auto-modification du profil par l'intéressé lui-même.
 *
 * Volontairement restreint aux coordonnées de contact et aux mentions
 * d'identité utilisées dans les exports : le rôle, le SOA, le matricule et le
 * CIN restent des données d'identité administrative, gérées par un
 * administrateur (cf. UsersController).
 *
 * Le ValidationPipe global (whitelist + forbidNonWhitelisted) rejette déjà
 * tout champ surnuméraire ; le service applique en plus son propre whitelist
 * pour que la règle tienne même si cette configuration change.
 */
export class UpdateMeDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  telephone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  adresse?: string;

  /** Valeur stable utilisée dans les documents, quel que soit l'écran. */
  @IsOptional()
  @IsIn(['Madame', 'Monsieur'])
  civilite?: 'Madame' | 'Monsieur' | null;

  /** Grade ou qualité affiché dans les exports. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  qualite?: string | null;
}
