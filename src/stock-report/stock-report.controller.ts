
import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { StockReportService } from './stock-report.service.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '@prisma/client';

@Controller('stock-report')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
export class StockReportController {
  constructor(
    private readonly stockReportService: StockReportService,
  ) {}

  @Get('chronologie')
  async obtenirChronologie(
    @Query('soaId', ParseIntPipe) soaId: number,
    @Req() req: any,
  ) {
    return this.stockReportService.simulerChronologie(soaId, req.user.id);
  }

  @Get('simulation')
  async simulerReportStock(
    @Query('soaId', ParseIntPipe) soaId: number,
    @Req() req: any,
  ) {
    return this.stockReportService.simulerReportStock(soaId, req.user.id);
  }
}
