import { IsString, MinLength } from 'class-validator';

/**
 * Changement de son propre mot de passe.
 *
 * Le mot de passe actuel est obligatoire : sans cette vérification, un jeton
 * volé suffirait à prendre définitivement la main sur le compte.
 *
 * Le mot de passe provisoire `srbHM####` posé à la création du compte est
 * changé ici par l'agent, ce qui retire de fait le mot de passe définitif.
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' })
  newPassword: string;
}