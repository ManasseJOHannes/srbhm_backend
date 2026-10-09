import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { SoaService } from './soa.service.js';
import { CreateSoaDto } from './dto/create-soa.dto.js';
import { UpdateSoaDto } from './dto/update-soa.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
@Controller('soa')
export class SoaController {
  constructor(private readonly soaService: SoaService) {}

  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  create(@Body() createSoaDto: CreateSoaDto) {
    return this.soaService.create(createSoaDto);
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
  update(@Param('id') id: string, @Body() updateSoaDto: UpdateSoaDto) {
    return this.soaService.update(+id, updateSoaDto);
  }

  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.soaService.remove(+id);
  }
}
