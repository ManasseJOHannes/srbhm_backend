import { Module } from '@nestjs/common';
import { MouvementsService } from './mouvements.service.js';
import { MouvementsController } from './mouvements.controller.js';

@Module({
  controllers: [MouvementsController],
  providers: [MouvementsService],
})
export class MouvementsModule {}
