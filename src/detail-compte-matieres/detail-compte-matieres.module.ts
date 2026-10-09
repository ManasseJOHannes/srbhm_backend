import { Module } from '@nestjs/common';
import { DetailCompteMatieresService } from './detail-compte-matieres.service.js';
import { DetailCompteMatieresController } from './detail-compte-matieres.controller.js';

@Module({
  controllers: [DetailCompteMatieresController],
  providers: [DetailCompteMatieresService],
})
export class DetailCompteMatieresModule {}
