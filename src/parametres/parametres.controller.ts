import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UpdatePrixMinimalDto } from './dto/update-prix-minimal.dto.js';
import { ParametresService } from './parametres.service.js';

@Controller('parametres')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ParametresController {
  constructor(private readonly parametresService: ParametresService) {}

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
  updatePrixMinimal(@Body() dto: UpdatePrixMinimalDto) {
    return this.parametresService.updatePrixMinimal(dto);
  }
}
