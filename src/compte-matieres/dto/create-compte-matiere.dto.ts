import { IsInt, Min } from 'class-validator';

export class CreateCompteMatiereDto {
  @IsInt()
  @Min(1)
  exerciceId: number;
}
