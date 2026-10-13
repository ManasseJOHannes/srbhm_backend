import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CreateAdminUserDto } from './create-admin-user.dto.js';

export class UpdateUserDto extends PartialType(CreateAdminUserDto) {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
