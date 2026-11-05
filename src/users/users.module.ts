import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { JournalAuditModule } from '../journal-audit/journal-audit.module.js';

@Module({
  imports: [JournalAuditModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
