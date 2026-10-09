import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

import { DetailCompteMatieresService } from './detail-compte-matieres.service.js';
import { CreateDetailCompteMatiereDto } from './dto/create-detail-compte-matiere.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('compte-matieres')
export class DetailCompteMatieresController {
  constructor(
    private readonly detailCompteMatieresService: DetailCompteMatieresService,
  ) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post(':compteMatiereId/details')
  create(
    @Param('compteMatiereId') compteMatiereId: string,
    @Body() dto: CreateDetailCompteMatiereDto,
    @Req() req: any,
  ) {
    return this.detailCompteMatieresService.create(
      +compteMatiereId,
      dto,
      req.user.id,
    );
  }
    @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    Role.COMPTABLE,
    Role.DEPOSITEUR_COMPTABLE,
  )
  @Get(':compteMatiereId/details')
  findAll(
    @Param('compteMatiereId') compteMatiereId: string,
    @Req() req: any,
  ) {
    return this.detailCompteMatieresService.findAll(
      +compteMatiereId,
      req.user.id,
    );
  }
}