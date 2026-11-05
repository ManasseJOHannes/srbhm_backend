import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateMouvementDto } from './dto/create-mouvement.dto.js';
import { MouvementsService } from './mouvements.service.js';
import { JournalAuditService } from '../journal-audit/journal-audit.service.js';
import { ACTIONS_AUDIT } from '../journal-audit/journal-audit.constants.js';

@Controller('mouvements')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MouvementsController {
  constructor(
    private readonly mouvementsService: MouvementsService,
    private readonly journalAuditService: JournalAuditService,
  ) {}

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post()
  async create(@Body() dto: CreateMouvementDto, @Req() req: any) {
    const mouvement = await this.mouvementsService.create(dto, req.user.id);
    const sens = dto.type === 'ENTREE' ? 'Entrée' : 'Sortie';
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.MOUVEMENT_CREE,
      entite: 'Mouvement',
      entiteId: mouvement.id,
      auteurId: req.user.id,
      details: `${sens} — article #${dto.articleId} — ${dto.quantite} × ${dto.prixUnitaire} Ar — exercice #${dto.exerciceId}`,
    });
    return mouvement;
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get()
  findAll(
    @Req() req: any,
    @Query('exerciceId') exerciceId?: string,
  ) {
    return this.mouvementsService.findAll(
      req.user.id,
      exerciceId ? Number(exerciceId) : undefined,
    );
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.mouvementsService.findOne(id, req.user.id);
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const mouvement = await this.mouvementsService.remove(id, req.user.id);
    const sens = mouvement.type === 'ENTREE' ? 'Entrée' : 'Sortie';
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.MOUVEMENT_SUPPRIME,
      entite: 'Mouvement',
      entiteId: id,
      auteurId: req.user.id,
      details: `${sens} — article #${mouvement.articleId} — ${String(
        mouvement.quantite,
      )} × ${String(mouvement.prixUnitaire)} Ar — exercice #${
        mouvement.exerciceId
      }`,
    });
    return mouvement;
  }
}
