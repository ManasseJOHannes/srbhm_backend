import { PartialType } from '@nestjs/mapped-types';
import { CreateParagrapheDto } from './create-paragraphe.dto.js';

export class UpdateParagrapheDto extends PartialType(CreateParagrapheDto) {}
