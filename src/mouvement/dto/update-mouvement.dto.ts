import { PartialType } from '@nestjs/mapped-types';
import { CreateMouvementDto } from './create-mouvement.dto.js';

export class UpdateMouvementDto extends PartialType(CreateMouvementDto) {}
