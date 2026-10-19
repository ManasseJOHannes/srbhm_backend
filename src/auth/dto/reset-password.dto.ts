import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Consommation d'un jeton de réinitialisation.
 *
 * Le jeton voyage dans l'URL envoyée par email ; seule sa racine SHA-256
 * est stockée en base. `newPassword` est ici choisi par l'utilisateur et
 * ne transite jamais par un email.
 */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères.',
  })
  newPassword: string;
}