import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { InventaireController } from './inventaire.controller.js';
import { InventaireService } from './inventaire.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [InventaireController],
  providers: [InventaireService],
})
export class InventaireModule {}
