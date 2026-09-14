import { Type } from "class-transformer";
import { IsInt, IsOptional,Max, Min, IsString, IsEnum } from "class-validator";
import { Role } from "@prisma/client";
export class PaginationUserDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}