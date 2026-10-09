import { Module } from '@nestjs/common';
import { MouvementService } from './mouvement.service.js';
import { MouvementController } from './mouvement.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [MouvementController],
  providers: [MouvementService],
  exports: [MouvementService],
})
export class MouvementModule {}
