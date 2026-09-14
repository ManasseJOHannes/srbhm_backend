import {IsEmail, IsNotEmpty, IsOptional, IsString} from 'class-validator';
export class LoginDto {
  @IsOptional()
  @IsString()
  imatricule?: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}