import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateCompteMatiereDto } from './dto/create-compte-matiere.dto.js';
import { CreateDetailDto } from './dto/create-detail.dto.js';
import { CompteMatieresService } from './compte-matieres.service.js';

@Controller('compte-matieres')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CompteMatieresController {
  constructor(private readonly compteMatieresService: CompteMatieresService) {}

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post()
  create(@Body() dto: CreateCompteMatiereDto, @Req() req: any) {
    return this.compteMatieresService.create(dto, req.user.id);
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
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.compteMatieresService.remove(id, req.user.id);
  }

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post(':id/details')
  addDetail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDetailDto,
    @Req() req: any,
  ) {
    return this.compteMatieresService.addDetail(id, dto, req.user.id);
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id/details')
  getDetails(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.compteMatieresService.getDetails(id, req.user.id);
  }
}
