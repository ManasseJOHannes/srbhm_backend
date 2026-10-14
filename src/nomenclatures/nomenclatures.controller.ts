import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateNomenclatureDto } from './dto/create-nomenclature.dto.js';
import { UpdateNomenclatureDto } from './dto/update-nomenclature.dto.js';
import { NomenclaturesService } from './nomenclatures.service.js';

@Controller('nomenclatures')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NomenclaturesController {
  constructor(private readonly nomenclaturesService: NomenclaturesService) {}

  @Roles(Role.COMPTABLE)
  @Post()
  create(@Body() createNomenclatureDto: CreateNomenclatureDto) {
    return this.nomenclaturesService.create(createNomenclatureDto);
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get()
  findAll() {
    return this.nomenclaturesService.findAll();
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.nomenclaturesService.findOne(id);
  }

  @Roles(Role.COMPTABLE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateNomenclatureDto: UpdateNomenclatureDto,
  ) {
    return this.nomenclaturesService.update(id, updateNomenclatureDto);
  }

  @Roles(Role.COMPTABLE)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.nomenclaturesService.remove(id);
  }
}
