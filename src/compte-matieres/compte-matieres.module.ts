import { Module } from '@nestjs/common';
import { CompteMatieresService } from './compte-matieres.service.js'
import { CompteMatieresController } from './compte-matieres.controller.js'
import { PrismaModule } from '../prisma/prisma.module.js';
import { StockReportModule } from '../stock-report/stock-report.module.js';
import { MouvementModule } from '../mouvement/mouvement.module.js';

@Module({
  imports: [PrismaModule, StockReportModule, MouvementModule],
  controllers: [CompteMatieresController],
  providers: [CompteMatieresService],
})
export class CompteMatieresModule {}
