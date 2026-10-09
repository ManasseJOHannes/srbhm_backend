import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { NomenclaturesService } from './nomenclatures.service.js';
import { CreateNomenclatureDto } from './dto/create-nomenclature.dto.js';
import { UpdateNomenclatureDto } from './dto/update-nomenclature.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';


@Controller('nomenclatures')
export class NomenclaturesController {
  constructor(
    private readonly nomenclaturesService: NomenclaturesService,
  ) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE)
  @Post()
  create(@Body() dto: CreateNomenclatureDto) {
    return this.nomenclaturesService.create(dto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    Role.COMPTABLE,
    Role.DEPOSITEUR_COMPTABLE,
  )
  @Get()
  findAll() {
    return this.nomenclaturesService.findAll();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    Role.COMPTABLE,
    Role.DEPOSITEUR_COMPTABLE,
  )
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.nomenclaturesService.findOne(+id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNomenclatureDto,
  ) {
    return this.nomenclaturesService.update(+id, dto);
  }
}