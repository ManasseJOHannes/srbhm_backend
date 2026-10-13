import { Module } from '@nestjs/common';
import { ExercicesService } from './exercices.service.js';
import { ExercicesController } from './exercices.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CompteMatieresModule } from '../compte-matieres/compte-matieres.module.js';

@Module({
  imports: [PrismaModule, CompteMatieresModule],
  controllers: [ExercicesController],
  providers: [ExercicesService],
})
export class ExercicesModule {}
