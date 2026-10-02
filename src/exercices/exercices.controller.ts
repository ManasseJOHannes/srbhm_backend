import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ExercicesService } from './exercices.service.js';
import { CreateExerciceDto } from './dto/create-exercice.dto.js';
import { UpdateExerciceDto } from './dto/update-exercice.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

@Controller('exercices')
export class ExercicesController {
  constructor(private readonly exercicesService: ExercicesService) {}
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post()
  create(
    @Body() createExerciceDto: CreateExerciceDto,
    @Req() req: any,
  ) {
    return this.exercicesService.create(
      createExerciceDto,
      req.user.id,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get()
  findAll(@Req() req: any) {
    return this.exercicesService.findAll(req.user.id);
  }
  
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.exercicesService.findOne(+id, req.user.id);
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
  remove(@Param('id') id: string, @Req() req: any) {
    return this.exercicesService.remove(+id, req.user.id);
  }
}
