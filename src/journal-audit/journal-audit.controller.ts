import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { QueryJournalAuditDto } from './dto/query-journal-audit.dto.js';
import { JournalAuditService } from './journal-audit.service.js';

@Controller('journal-audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class JournalAuditController {
  constructor(private readonly journalAuditService: JournalAuditService) {}

  @Roles(Role.ADMIN)
  @Get()
  lister(@Query() query: QueryJournalAuditDto) {
    return this.journalAuditService.lister(query);
  }
}
