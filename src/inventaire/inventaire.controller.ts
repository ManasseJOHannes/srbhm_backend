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
import { JournalAuditService } from '../journal-audit/journal-audit.service.js';
import { ACTIONS_AUDIT } from '../journal-audit/journal-audit.constants.js';

@Controller('inventaires')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventaireController {
  constructor(
    private readonly inventaireService: InventaireService,
    private readonly journalAuditService: JournalAuditService,
  ) {}

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
  async upsertLigne(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Req() req: any,
    @Body() dto: UpsertLigneInventaireDto,
  ) {
    const inventaire = await this.inventaireService.upsertLigne(
      exerciceId,
      req.user.id,
      dto,
    );
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.INVENTAIRE_LIGNE_ENREGISTREE,
      entite: 'Inventaire',
      entiteId: inventaire.inventaireId ?? undefined,
      auteurId: req.user.id,
      details: `Exercice #${exerciceId} — article #${dto.articleId} — constaté ${
        dto.quantiteConstatee ?? 0
      } — prix ${dto.prixUnitaire} Ar`,
    });
    return inventaire;
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Delete('exercices/:exerciceId/lignes/:ligneId')
  async supprimerLigne(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Req() req: any,
  ) {
    const inventaire = await this.inventaireService.supprimerLigne(
      exerciceId,
      req.user.id,
      ligneId,
    );
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.INVENTAIRE_LIGNE_SUPPRIMEE,
      entite: 'Inventaire',
      entiteId: inventaire.inventaireId ?? undefined,
      auteurId: req.user.id,
      details: `Exercice #${exerciceId} — ligne #${ligneId}`,
    });
    return inventaire;
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Put('exercices/:exerciceId')
  async enregistrer(
    @Param('exerciceId', ParseIntPipe) exerciceId: number,
    @Req() req: any,
    @Body() dto: SaveInventaireDto,
  ) {
    const inventaire = await this.inventaireService.enregistrer(
      exerciceId,
      req.user.id,
      dto,
    );
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.INVENTAIRE_ENREGISTRE,
      entite: 'Inventaire',
      entiteId: inventaire.inventaireId ?? undefined,
      auteurId: req.user.id,
      details: `Exercice #${exerciceId} — ${dto.lignes.length} ligne(s) — date ${dto.dateInventaire}`,
    });
    return inventaire;
  }
}
