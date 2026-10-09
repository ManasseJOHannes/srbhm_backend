import { PartialType } from '@nestjs/mapped-types';
import { CreateCompteMatiereDto } from './create-compte-matiere.dto.js';

export class UpdateCompteMatiereDto extends PartialType(CreateCompteMatiereDto) {}
