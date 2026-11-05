import { Module } from '@nestjs/common';
import { MouvementsService } from './mouvements.service.js';
import { MouvementsController } from './mouvements.controller.js';
import { JournalAuditModule } from '../journal-audit/journal-audit.module.js';

@Module({
  imports: [JournalAuditModule],
  controllers: [MouvementsController],
  providers: [MouvementsService],
})
export class MouvementsModule {}
