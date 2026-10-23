import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { SaveInventaireDto } from './dto/save-inventaire.dto.js';
import { UpdateObservationEtatDto } from './dto/update-observation-etat.dto.js';
import { UpsertLigneInventaireDto } from './dto/upsert-ligne-inventaire.dto.js';
import { InventaireService } from './inventaire.service.js';

@Controller('inventaires')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventaireController {
  constructor(private readonly inventaireService: InventaireService) {}

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get('exercices/:exerciceId')
  obtenir(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Req() req: any,
  ) {
    return this.inventaireService.obtenir(exerciceId, req.user.id);
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Patch('exercices/:exerciceId/observation-etat')
  updateObservationEtat(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Req() req: any,
    @Body() dto: UpdateObservationEtatDto,
  ) {
    return this.inventaireService.updateObservationEtat(
      exerciceId,
      req.user.id,
      dto,
    );
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Patch('exercices/:exerciceId/lignes')
  upsertLigne(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Req() req: any,
    @Body() dto: UpsertLigneInventaireDto,
  ) {
    return this.inventaireService.upsertLigne(
      exerciceId,
      req.user.id,
      dto,
    );
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Delete('exercices/:exerciceId/lignes/:ligneId')
  supprimerLigne(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Req() req: any,
  ) {
    return this.inventaireService.supprimerLigne(
      exerciceId,
      req.user.id,
      ligneId,
    );
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Put('exercices/:exerciceId')
  enregistrer(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Req() req: any,
    @Body() dto: SaveInventaireDto,
  ) {
    return this.inventaireService.enregistrer(exerciceId, req.user.id, dto);
  }
}
