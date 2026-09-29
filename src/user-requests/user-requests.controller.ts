import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UserRequestsService } from './user-requests.service.js';
import { CreateUserRequestDto } from './dto/create-user-request.dto.js';
import { RejectUserRequestDto } from './dto/reject-user-request.dto.js';

import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role } from '@prisma/client';

@Controller('user-requests')
export class UserRequestsController {
  constructor(
    private readonly userRequestsService: UserRequestsService,
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
  approve(
    @Param('id', ParseIntPipe) id: number,) {
    return this.userRequestsService.approve(
      Number(id),
    );
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  reject(
    @Param('id') id: string,
    @Body() rejectUserRequestDto: RejectUserRequestDto,
  ) {
    return this.userRequestsService.reject(
      Number(id),
      rejectUserRequestDto,
    );
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(Role.ADMIN)
  findOne(@Param("id") id:string){
    return this.userRequestsService.findOne(Number(id));
  }
}