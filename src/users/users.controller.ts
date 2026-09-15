import { Controller, Get, Post, Body, Patch, Param, Delete, } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Query } from '@nestjs/common';
import { PaginationUserDto } from './dto/pagination-user.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateAdminUserDto } from './dto/create-admin-user.dto.js';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() CreateUserDto: CreateAdminUserDto) {
    return this.usersService.create(CreateUserDto);
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
