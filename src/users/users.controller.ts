import { Controller, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Query } from '@nestjs/common';
import { PaginationUserDto } from './dto/pagination-user.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateAdminUserDto } from './dto/create-admin-user.dto.js';
import { JournalAuditService } from '../journal-audit/journal-audit.service.js';
import { ACTIONS_AUDIT } from '../journal-audit/journal-audit.constants.js';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly journalAuditService: JournalAuditService,
  ) {}

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() CreateUserDto: CreateAdminUserDto, @Req() req: any) {
    const user = await this.usersService.create(CreateUserDto);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.UTILISATEUR_CREE,
      entite: 'Utilisateur',
      entiteId: user.id,
      auteurId: req.user.id,
      details: `${user.prenom} ${user.nom} (${user.imatricule}), rôle ${user.role}`,
    });
    return user;
  }

  // @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN)
  @Get()
  findAll(@Query() pagination: PaginationUserDto) {
    return this.usersService.findAll(
      pagination.page, 
      pagination.limit,
      pagination.search,
      pagination.role
    );
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(Number(id));
  }
  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    const user = await this.usersService.update(+id, updateUserDto);
    const champs = Object.keys(updateUserDto).map((champ) =>
      champ === 'password' ? 'mot de passe' : champ,
    );
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.UTILISATEUR_MODIFIE,
      entite: 'Utilisateur',
      entiteId: user.id,
      auteurId: req.user.id,
      details: `${user.prenom} ${user.nom} (${user.imatricule}) — champs modifiés : ${
        champs.length > 0 ? champs.join(', ') : 'aucun'
      }`,
    });
    return user;
  }

  /**
   * Génère un mot de passe provisoire pour un compte sans email.
   *
   * Le mot de passe est renvoyé en clair une seule fois : à l'administrateur
   * de le transmettre à l'utilisateur, qui le changera depuis « Compte ».
   */
  @Roles(Role.ADMIN)
  @Post(':id/mdp-provisoire')
  async genererMotDePasseProvisoire(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const resultat = await this.usersService.genererMotDePasseProvisoire(
      Number(id),
    );
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.MOT_DE_PASSE_PROVISOIRE,
      entite: 'Utilisateur',
      entiteId: Number(id),
      auteurId: req.user.id,
      details: 'Mot de passe provisoire généré',
    });
    return resultat;
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const cible = await this.usersService.findOne(+id);
    await this.usersService.remove(+id);
    await this.journalAuditService.enregistrer({
      action: ACTIONS_AUDIT.UTILISATEUR_SUPPRIME,
      entite: 'Utilisateur',
      entiteId: +id,
      auteurId: req.user.id,
      details: `${cible.prenom} ${cible.nom} (${cible.imatricule})`,
    });
    return { message: `User with ID ${id} has been deleted` };
  }
}
