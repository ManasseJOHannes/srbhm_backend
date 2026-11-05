import { Module } from '@nestjs/common';
import { ParametresController } from './parametres.controller.js';
import { ParametresService } from './parametres.service.js';
import { JournalAuditModule } from '../journal-audit/journal-audit.module.js';

@Module({
  imports: [JournalAuditModule],
  controllers: [ParametresController],
  providers: [ParametresService],
})
export class ParametresModule {}
