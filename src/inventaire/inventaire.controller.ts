import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { SaveInventaireDto } from './dto/save-inventaire.dto.js';
import { InventaireService } from './inventaire.service.js';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('inventaires')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventaireController {
  constructor(private readonly inventaireService: InventaireService) {}

  @Get('exercices/:exerciceId')
  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  obtenir(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Req() request: AuthenticatedRequest,
    @Query('dateInventaire') dateInventaire?: string,
  ) {
    return this.inventaireService.obtenir(
      exerciceId,
      request.user.id,
      dateInventaire,
    );
  }

  @Put('exercices/:exerciceId')
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  enregistrer(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Req() request: AuthenticatedRequest,
    @Body() dto: SaveInventaireDto,
  ) {
    return this.inventaireService.enregistrer(
      exerciceId,
      request.user.id,
      dto,
    );
  }
}
