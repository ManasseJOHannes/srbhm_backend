import {
  IsInt,
  Min,
} from 'class-validator';

export class CreateExerciceDto {
  @IsInt()
  @Min(2000)
  annee: number;

  
}