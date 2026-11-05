import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { SoaService } from './soa.service.js';
import { CreateSoaDto } from './dto/create-soa.dto.js';
import { UpdateSoaDto } from './dto/update-soa.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { JournalAuditService } from '../journal-audit/journal-audit.service.js';
import { ACTIONS_AUDIT } from '../journal-audit/journal-audit.constants.js';
@Controller('soa')
export class SoaController {
  constructor(
    private readonly soaService: SoaService,
    private readonly journalAuditService: JournalAuditService,
  ) {}

  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  async create(@Body() createSoaDto: CreateSoaDto, @Req() req: any) {
    const soa = await this.soaService.create(createSoaDto);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.SOA_CREE,
      entite: 'SOA',
      entiteId: soa.id,
      auteurId: req.user.id,
      details: `${soa.code} — ${soa.libelle}`,
    });
    return soa;
  }

  // Minimal public list required by the unauthenticated registration form.
  @Get('actifs')
  findActive() {
    return this.soaService.findActive();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get()
  findAll(@Req() req: any) {
    return this.soaService.findAll(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.soaService.findOne(+id, req.user.id);
  }

  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSoaDto: UpdateSoaDto,
    @Req() req: any,
  ) {
    const soa = await this.soaService.update(+id, updateSoaDto);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.SOA_MODIFIE,
      entite: 'SOA',
      entiteId: soa.id,
      auteurId: req.user.id,
      details: `${soa.code} — ${soa.libelle}`,
    });
    return soa;
  }

  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const soa = await this.soaService.remove(+id);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.SOA_SUPPRIME,
      entite: 'SOA',
      entiteId: soa.id,
      auteurId: req.user.id,
      details: `${soa.code} — ${soa.libelle}`,
    });
    return soa;
  }
}
