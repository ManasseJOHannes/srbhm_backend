import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  
} from 'class-validator';

import { Role } from '@prisma/client';

export class CreateAdminUserDto {
  @IsString()
  @IsNotEmpty()
  imatricule: string;

  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  prenom: string;

  @IsString()
  @IsNotEmpty()
  cin: string;

  @IsString()
  @IsNotEmpty()
  telephone: string;

  @IsInt()
  soaId:number

  @IsEnum(Role)
  role: Role;

  @IsString()
  @IsNotEmpty()
  adresse: string;

  @IsOptional()
  @IsEmail()
  email?: string;

}