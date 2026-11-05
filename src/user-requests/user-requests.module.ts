import { Module } from '@nestjs/common';
import { UserRequestsService } from './user-requests.service.js';
import { UserRequestsController } from './user-requests.controller.js';
import { MailModule } from '../mail/mail.module.js';
import { JournalAuditModule } from '../journal-audit/journal-audit.module.js';

@Module({
  imports: [MailModule, JournalAuditModule],
  controllers: [UserRequestsController],
  providers: [UserRequestsService],
})
export class UserRequestsModule {}
