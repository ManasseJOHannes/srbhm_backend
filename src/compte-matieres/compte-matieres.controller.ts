import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateCompteMatiereDto } from './dto/create-compte-matiere.dto.js';
import { CreateDetailDto } from './dto/create-detail.dto.js';
import { CompteMatieresService } from './compte-matieres.service.js';
import { JournalAuditService } from '../journal-audit/journal-audit.service.js';
import { ACTIONS_AUDIT } from '../journal-audit/journal-audit.constants.js';

@Controller('compte-matieres')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CompteMatieresController {
  constructor(
    private readonly compteMatieresService: CompteMatieresService,
    private readonly journalAuditService: JournalAuditService,
  ) {}

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post()
  async create(@Body() dto: CreateCompteMatiereDto, @Req() req: any) {
    const compte = await this.compteMatieresService.create(dto, req.user.id);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.COMPTE_CREE,
      entite: 'CompteMatiere',
      entiteId: compte.id,
      auteurId: req.user.id,
      details: `Ouverture du compte de l'exercice ${compte.exercice.annee}${
        compte.exercice.soa ? ` (${compte.exercice.soa.code})` : ''
      }`,
    });
    return compte;
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get()
  findAll(@Req() req: any) {
    return this.compteMatieresService.findAll(req.user.id);
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.compteMatieresService.findOne(id, req.user.id);
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const compte = await this.compteMatieresService.remove(id, req.user.id);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.COMPTE_SUPPRIME,
      entite: 'CompteMatiere',
      entiteId: id,
      auteurId: req.user.id,
      details: `Suppression du compte matière de l'exercice #${compte.exerciceId}`,
    });
    return compte;
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post(':id/details')
  async addDetail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDetailDto,
    @Req() req: any,
  ) {
    const detail = await this.compteMatieresService.addDetail(
      id,
      dto,
      req.user.id,
    );
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.COMPTE_DETAIL_AJOUTE,
      entite: 'CompteMatiere',
      entiteId: id,
      auteurId: req.user.id,
      details: `${detail.article.designation} — existant ${dto.existantDebut} × ${dto.prixUnitaire} Ar${
        dto.folioGrandLivre ? ` — folio ${dto.folioGrandLivre}` : ''
      }`,
    });
    return detail;
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id/details')
  getDetails(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.compteMatieresService.getDetails(id, req.user.id);
  }
}
