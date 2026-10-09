


import { Module } from '@nestjs/common';
import { StockReportService } from './stock-report.service.js';
import { StockReportController } from './stock-report.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [StockReportController],
  providers: [StockReportService],
  exports: [StockReportService],
})
export class StockReportModule {}
