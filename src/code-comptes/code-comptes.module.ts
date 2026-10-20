import { Module } from '@nestjs/common';
import { CodeComptesService } from './code-comptes.service.js';
import { CodeComptesController } from './code-comptes.controller.js';

@Module({
  controllers: [CodeComptesController],
  providers: [CodeComptesService],
})
export class CodeComptesModule {}
