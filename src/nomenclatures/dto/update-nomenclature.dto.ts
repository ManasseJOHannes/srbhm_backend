import { PartialType } from '@nestjs/mapped-types';
import { CreateNomenclatureDto } from './create-nomenclature.dto.js';

export class UpdateNomenclatureDto extends PartialType(CreateNomenclatureDto) {}
