import { PartialType } from '@nestjs/mapped-types';
import { CreateDetailCompteMatiereDto } from './create-detail-compte-matiere.dto.js';

export class UpdateDetailCompteMatiereDto extends PartialType(CreateDetailCompteMatiereDto) {}
