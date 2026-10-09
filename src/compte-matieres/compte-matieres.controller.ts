import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { CompteMatieresService } from './compte-matieres.service.js';
import { CreateCompteMatiereDto } from './dto/create-compte-matiere.dto.js';
import { UpdateCompteMatiereDto } from './dto/update-compte-matiere.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '@prisma/client';

@Controller('compte-matieres')
export class CompteMatieresController {
  constructor(private readonly compteMatieresService: CompteMatieresService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post()
  create(
    @Body() createCompteMatiereDto: CreateCompteMatiereDto,
    @Req() req: any
  ) {
    return this.compteMatieresService.create(
      createCompteMatiereDto,
      req.user.id
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE, Role.COMPTABLE)
  @Get()
  findAll(@Req() req: any) {
    return this.compteMatieresService.findAll(req.user.id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE, Role.COMPTABLE)
  findOne(
    @Param('id') id: string,
    @Req() req: any
  ) {
    return this.compteMatieresService.findOne(
      +id,
      req.user.id
    );
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  update(
    @Param('id') id: string,
    @Body() updateCompteMatiereDto: UpdateCompteMatiereDto,
    @Req() req: any,
  ) {
    return this.compteMatieresService.update(
      +id,
      updateCompteMatiereDto,
      req.user.id,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.compteMatieresService.remove(+id, req.user.id);
  }
}
