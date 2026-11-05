import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ExercicesService } from './exercices.service.js';
import { CreateExerciceDto } from './dto/create-exercice.dto.js';
import { UpdateExerciceDto } from './dto/update-exercice.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { JournalAuditService } from '../journal-audit/journal-audit.service.js';
import { ACTIONS_AUDIT } from '../journal-audit/journal-audit.constants.js';

@Controller('exercices')
export class ExercicesController {
  constructor(
    private readonly exercicesService: ExercicesService,
    private readonly journalAuditService: JournalAuditService,
  ) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post()
  async create(
    @Body() createExerciceDto: CreateExerciceDto,
    @Req() req: any,
  ) {
    const exercice = await this.exercicesService.create(
      createExerciceDto,
      req.user.id,
    );
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.EXERCICE_CREE,
      entite: 'Exercice',
      entiteId: exercice?.id,
      auteurId: req.user.id,
      details: `Exercice ${createExerciceDto.annee}${
        exercice?.soa ? ` (${exercice.soa.code})` : ''
      }`,
    });
    return exercice;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get()
  findAll(@Req() req: any) {
    return this.exercicesService.findAll(req.user.id);
  }
  
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.exercicesService.findOne(+id, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE, Role.ADMIN)
  @Patch(':id/cloturer')
  async cloturer(@Param('id') id: string, @Req() req: any) {
    const exercice = await this.exercicesService.cloturer(+id);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.EXERCICE_CLOTURE,
      entite: 'Exercice',
      entiteId: exercice.id,
      auteurId: req.user.id,
      details: `Exercice ${exercice.annee}${
        exercice.soa ? ` (${exercice.soa.code})` : ''
      } clôturé via la génération du Quitus`,
    });
    return exercice;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateExerciceDto: UpdateExerciceDto, @Req() req: any) {
    return this.exercicesService.update(+id, updateExerciceDto, req.user.id);
  }
  
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const exercice = await this.exercicesService.remove(+id, req.user.id);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.EXERCICE_SUPPRIME,
      entite: 'Exercice',
      entiteId: exercice.id,
      auteurId: req.user.id,
      details: `Exercice ${exercice.annee} (SOA #${exercice.soaId})`,
    });
    return exercice;
  }
}
