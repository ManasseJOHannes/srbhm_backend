import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UserRequestsModule } from './user-requests/user-requests.module.js';
import { SoaModule } from './soa/soa.module.js';
import { ExercicesModule } from './exercices/exercices.module.js';
import { ArticleModule } from './article/article.module.js';
import { CompteMatieresModule } from './compte-matieres/compte-matieres.module.js';
import { NomenclaturesModule } from './nomenclatures/nomenclatures.module.js';
import { MouvementModule } from './mouvement/mouvement.module.js';
import { DetailCompteMatieresModule } from './detail-compte-matieres/detail-compte-matieres.module.js';
import { StockReportService } from './stock-report/stock-report.service.js';
import { StockReportModule } from './stock-report/stock-report.module.js';
import { InventaireModule } from './inventaire/inventaire.module.js';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, UserRequestsModule, SoaModule, ExercicesModule, ArticleModule, CompteMatieresModule, NomenclaturesModule, MouvementModule, DetailCompteMatieresModule, StockReportModule, InventaireModule],
  controllers: [AppController],
  providers: [AppService, StockReportService],
})
export class AppModule {}
