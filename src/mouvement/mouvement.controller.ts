import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

import { MouvementService } from './mouvement.service.js';
import { CreateMouvementDto } from './dto/create-mouvement.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('mouvement')
export class MouvementController {
  constructor(
    private readonly mouvementService: MouvementService,
  ) {}

  // Mouvement année courante
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post()
  create(
    @Body() dto: CreateMouvementDto,
    @Req() req: any,
  ) {
    return this.mouvementService.create(
      dto,
      req.user.id,
    );
  }

  // Mouvement historique d'un Compte Matière
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post('compte-matiere/:compteMatiereId')
  createHistorique(
    @Param('compteMatiereId') compteMatiereId: string,
    @Body() dto: CreateMouvementDto,
    @Req() req: any,
  ) {
    return this.mouvementService.createHistorique(
      +compteMatiereId,
      dto,
      req.user.id,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post('report-stock/:exerciceSourceId')
  reporterStockVersExerciceSuivant(
    @Param('exerciceSourceId') exerciceSourceId: string,
    @Req() req: any,
  ) {
    return this.mouvementService.reporterStockVersExerciceSuivant(
      +exerciceSourceId,
      req.user.id,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get('lots-disponibles/:exerciceId')
  findLotsDisponiblesSortie(
    @Param('exerciceId') exerciceId: string,
    @Req() req: any,
  ) {
    return this.mouvementService.findLotsDisponiblesSortie(
      +exerciceId,
      req.user.id,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    Role.COMPTABLE,
    Role.DEPOSITEUR_COMPTABLE,
  )
  @Get()
  findAll(@Req() req: any) {
    return this.mouvementService.findAll(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    Role.COMPTABLE,
    Role.DEPOSITEUR_COMPTABLE,
  )
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.mouvementService.findOne(
      +id,
      req.user.id,
    );
  }
}
