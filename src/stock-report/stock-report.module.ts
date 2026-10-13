import { Module } from '@nestjs/common';
import { StockReportService } from './stock-report.service.js';
import { StockReportController } from './stock-report.controller.js';

@Module({
  controllers: [StockReportController],
  providers: [StockReportService],
})
export class StockReportModule {}
