import { Module } from '@nestjs/common';
import { SoaService } from './soa.service.js';
import { SoaController } from './soa.controller.js';
import { JournalAuditModule } from '../journal-audit/journal-audit.module.js';

@Module({
  imports: [JournalAuditModule],
  controllers: [SoaController],
  providers: [SoaService],
})
export class SoaModule {}
