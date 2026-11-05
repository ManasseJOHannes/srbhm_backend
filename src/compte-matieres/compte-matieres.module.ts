import { Module } from '@nestjs/common';
import { CompteMatieresService } from './compte-matieres.service.js';
import { CompteMatieresController } from './compte-matieres.controller.js';
import { JournalAuditModule } from '../journal-audit/journal-audit.module.js';

@Module({
  imports: [JournalAuditModule],
  controllers: [CompteMatieresController],
  providers: [CompteMatieresService],
  exports: [CompteMatieresService],
})
export class CompteMatieresModule {}
