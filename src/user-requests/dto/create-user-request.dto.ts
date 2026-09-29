import { IsEmail, IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
export class CreateUserRequestDto {
  @IsString()
  @MinLength(1)
  imatricule: string;

  @IsString()
  @MinLength(1)
  nom: string;

  @IsString()
  @MinLength(1)
  prenom: string;

  @IsString()
  @MinLength(1)
  cin: string;

  @IsString()
  @MinLength(1)
  telephone: string;

  @IsString()
  @MinLength(1)
  service: string;

  @IsIn([
    'USER',
    'ORDONNATEUR',
    'COMPTABLE',
    "DEPOSITEUR_COMPTABLE"
  ])
  role: Role;

  @IsString()
  @MinLength(1)
  adresse: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
