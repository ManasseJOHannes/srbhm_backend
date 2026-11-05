import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UserRequestsService } from './user-requests.service.js';
import { CreateUserRequestDto } from './dto/create-user-request.dto.js';
import { RejectUserRequestDto } from './dto/reject-user-request.dto.js';

import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role } from '@prisma/client';
import { JournalAuditService } from '../journal-audit/journal-audit.service.js';
import { ACTIONS_AUDIT } from '../journal-audit/journal-audit.constants.js';

@Controller('user-requests')
export class UserRequestsController {
  constructor(
    private readonly userRequestsService: UserRequestsService,
    private readonly journalAuditService: JournalAuditService,
  ) {}

  @Post()
  create(
    @Body() createUserRequestDto: CreateUserRequestDto,
  ) {
    return this.userRequestsService.create(
      createUserRequestDto,
    );
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.userRequestsService.findAll();
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const resultat = await this.userRequestsService.approve(Number(id));
    const demande = resultat.request;
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.DEMANDE_APPROUVEE,
      entite: 'DemandeCompte',
      entiteId: id,
      auteurId: req.user.id,
      details: `Demande de ${demande.prenom} ${demande.nom} approuvée (utilisateur #${resultat.user.id})`,
    });
    return resultat;
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() rejectUserRequestDto: RejectUserRequestDto,
    @Req() req: any,
  ) {
    const resultat = await this.userRequestsService.reject(
      id,
      rejectUserRequestDto,
    );
    const demande = resultat.request;
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.DEMANDE_REJETEE,
      entite: 'DemandeCompte',
      entiteId: id,
      auteurId: req.user.id,
      details: `Demande de ${demande.prenom} ${demande.nom} rejetée — motif : ${
        demande.rejectionReason ?? 'non précisé'
      }`,
    });
    return resultat;
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(Role.ADMIN)
  findOne(@Param("id", ParseIntPipe) id:number){
    return this.userRequestsService.findOne(id);
  }
}
