import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateSoaDto {
  @IsString()
  @Length(17, 17)
  @Matches(/^[0-9]{2}-[0-9]{2}-[0-9]{1}-[A-Z]{1}[0-9]{2}-[0-9]{5}$/, {
    message: 'Le code SOA doit suivre le format 00-23-2-F15-30101.',
  })
  code: string;

  @IsString()
  @Length(1, 150)
  libelle: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  localite?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}