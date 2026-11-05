import { IsNumber, Min } from 'class-validator';

export class UpdatePrixMinimalDto {
  @IsNumber()
  @Min(1)
  prixMinimal: number;
}
