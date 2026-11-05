import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UpdatePrixMinimalDto } from './dto/update-prix-minimal.dto.js';
import { ParametresService } from './parametres.service.js';
import { JournalAuditService } from '../journal-audit/journal-audit.service.js';
import { ACTIONS_AUDIT } from '../journal-audit/journal-audit.constants.js';

@Controller('parametres')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ParametresController {
  constructor(
    private readonly parametresService: ParametresService,
    private readonly journalAuditService: JournalAuditService,
  ) {}

  @Roles(
    Role.ADMIN,
    Role.COMPTABLE,
    Role.DEPOSITEUR_COMPTABLE,
    Role.ORDONNATEUR,
  )
  @Get('prix-minimal')
  async getPrixMinimal() {
    return { prixMinimal: await this.parametresService.getPrixMinimal() };
  }

  @Roles(Role.COMPTABLE)
  @Put('prix-minimal')
  async updatePrixMinimal(
    @Body() dto: UpdatePrixMinimalDto,
    @Req() req: any,
  ) {
    const ancien = await this.parametresService.getPrixMinimal();
    const resultat = await this.parametresService.updatePrixMinimal(dto);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.PRIX_MINIMAL_MODIFIE,
      entite: 'Parametre',
      auteurId: req.user.id,
      details: `${ancien} Ar → ${dto.prixMinimal} Ar`,
    });
    return resultat;
  }
}
