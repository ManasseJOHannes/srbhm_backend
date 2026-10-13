import { Module } from '@nestjs/common';
import { InventaireService } from './inventaire.service.js';
import { InventaireController } from './inventaire.controller.js';

@Module({
  controllers: [InventaireController],
  providers: [InventaireService],
})
export class InventaireModule {}
