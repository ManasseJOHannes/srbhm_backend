import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UserRequestsModule } from './user-requests/user-requests.module.js';
import { SoaModule } from './soa/soa.module.js';
import { ExercicesModule } from './exercices/exercices.module.js';
import { NomenclaturesModule } from './nomenclatures/nomenclatures.module.js';
import { ArticlesModule } from './articles/articles.module.js';
import { CompteMatieresModule } from './compte-matieres/compte-matieres.module.js';
import { MouvementsModule } from './mouvements/mouvements.module.js';
import { InventaireModule } from './inventaire/inventaire.module.js';
import { StockReportModule } from './stock-report/stock-report.module.js';
import { CodeComptesModule } from './code-comptes/code-comptes.module.js';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, UserRequestsModule, SoaModule, ExercicesModule, NomenclaturesModule, ArticlesModule, CompteMatieresModule, MouvementsModule, InventaireModule, StockReportModule, CodeComptesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
