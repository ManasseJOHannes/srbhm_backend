import { Controller, Get, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { StockReportService } from './stock-report.service.js';

@Controller('stock-report')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StockReportController {
  constructor(private readonly stockReportService: StockReportService) {}

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get('simulation')
  simuler(
    @Query('soaId', ParseIntPipe) soaId: number,
    @Req() req: any,
  ) {
    return this.stockReportService.simuler(soaId, req.user.id);
  }
}
