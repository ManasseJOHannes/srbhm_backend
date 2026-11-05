import { Module } from '@nestjs/common';
import { InventaireService } from './inventaire.service.js';
import { InventaireController } from './inventaire.controller.js';
import { JournalAuditModule } from '../journal-audit/journal-audit.module.js';

@Module({
  imports: [JournalAuditModule],
  controllers: [InventaireController],
  providers: [InventaireService],
})
export class InventaireModule {}
