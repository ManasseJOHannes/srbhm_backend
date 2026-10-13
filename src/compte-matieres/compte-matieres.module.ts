import { Module } from '@nestjs/common';
import { CompteMatieresService } from './compte-matieres.service.js';
import { CompteMatieresController } from './compte-matieres.controller.js';

@Module({
  controllers: [CompteMatieresController],
  providers: [CompteMatieresService],
  exports: [CompteMatieresService],
})
export class CompteMatieresModule {}
