import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CodeComptesService } from './code-comptes.service.js';
import { CreateParagrapheDto } from './dto/create-paragraphe.dto.js';
import { UpdateParagrapheDto } from './dto/update-paragraphe.dto.js';

@Controller('code-comptes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CodeComptesController {
  constructor(private readonly codeComptesService: CodeComptesService) {}

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get()
  findAll() {
    return this.codeComptesService.findAll();
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.codeComptesService.findOne(id);
  }

  @Roles(Role.COMPTABLE)
  @Post()
  create(@Body() dto: CreateParagrapheDto) {
    return this.codeComptesService.create(dto);
  }

  @Roles(Role.COMPTABLE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParagrapheDto,
  ) {
    return this.codeComptesService.update(id, dto);
  }

  @Roles(Role.COMPTABLE)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.codeComptesService.remove(id);
  }
}
