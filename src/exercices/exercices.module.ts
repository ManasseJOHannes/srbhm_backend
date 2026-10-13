import { Module } from '@nestjs/common';
import { ExercicesService } from './exercices.service.js';
import { ExercicesController } from './exercices.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ExercicesController],
  providers: [ExercicesService],
})
export class ExercicesModule {}
