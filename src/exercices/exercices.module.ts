import { Module } from '@nestjs/common';
import { ExercicesService } from './exercices.service.js';
import { ExercicesController } from './exercices.controller.js';

@Module({
  controllers: [ExercicesController],
  providers: [ExercicesService],
})
export class ExercicesModule {}
