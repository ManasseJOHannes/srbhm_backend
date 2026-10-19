import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Demande de réinitialisation.
 *
 * Volontairement minimaliste : on accepte un identifiant unique
 * (matricule OU email) et on répond toujours la même chose, afin de ne
 * jamais révéler quels comptes existent.
 */
export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;
}