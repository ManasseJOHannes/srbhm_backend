import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UserRequestsService } from './user-requests.service.js';
import { CreateUserRequestDto } from './dto/create-user-request.dto.js';
import { UpdateUserRequestDto } from './dto/update-user-request.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AuthGuard } from '@nestjs/passport';

@Controller('user-requests')
export class UserRequestsController {
  constructor(private readonly userRequestsService: UserRequestsService) {}

  @Post()
  create(@Body() createUserRequestDto: CreateUserRequestDto) {
    return this.userRequestsService.create(createUserRequestDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'),RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.userRequestsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userRequestsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserRequestDto: UpdateUserRequestDto) {
    return this.userRequestsService.update(+id, updateUserRequestDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userRequestsService.remove(+id);
  }
}
