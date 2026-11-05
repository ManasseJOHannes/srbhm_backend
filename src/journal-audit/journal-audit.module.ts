import { Module } from '@nestjs/common';

import { JournalAuditController } from './journal-audit.controller.js';
import { JournalAuditService } from './journal-audit.service.js';

@Module({
  controllers: [JournalAuditController],
  providers: [JournalAuditService],
  exports: [JournalAuditService],
})
export class JournalAuditModule {}
