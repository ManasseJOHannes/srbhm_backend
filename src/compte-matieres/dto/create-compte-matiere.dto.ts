import { Min, IsInt } from "class-validator";

export class CreateCompteMatiereDto {
    @IsInt()
    @Min(2000, { message: 'L\'année doit être supérieure ou égale à 2000' })
    annee: number;
}
