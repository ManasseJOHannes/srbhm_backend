import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateMouvementDto } from './dto/create-mouvement.dto.js';
import { MouvementsService } from './mouvements.service.js';

@Controller('mouvements')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MouvementsController {
  constructor(private readonly mouvementsService: MouvementsService) {}

  @Roles(Role.DEPOSITEUR_COMPTABLE)
  @Post()
  create(@Body() dto: CreateMouvementDto, @Req() req: any) {
    return this.mouvementsService.create(dto, req.user.id);
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get()
  findAll(
    @Req() req: any,
    @Query('exerciceId') exerciceId?: string,
  ) {
    return this.mouvementsService.findAll(
      req.user.id,
      exerciceId ? Number(exerciceId) : undefined,
    );
  }

  @Roles(Role.ADMIN, Role.COMPTABLE, Role.DEPOSITEUR_COMPTABLE)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.mouvementsService.findOne(id, req.user.id);
  }
}
