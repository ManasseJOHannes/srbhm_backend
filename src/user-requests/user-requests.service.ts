import { Injectable } from '@nestjs/common';
import { CreateUserRequestDto } from './dto/create-user-request.dto.js';
import { UpdateUserRequestDto } from './dto/update-user-request.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UserRequestsService {
  constructor(private readonly prisma:PrismaService){}
  async create(createUserRequestDto: CreateUserRequestDto) {
    return this.prisma.userRequest.create({
      data: {
        imatricule: createUserRequestDto.imatricule,
        nom: createUserRequestDto.nom,
        prenom: createUserRequestDto.prenom,
        cin: createUserRequestDto.cin,
        telephone: createUserRequestDto.telephone,
        service: createUserRequestDto.service,
        role: createUserRequestDto.role,
        adresse: createUserRequestDto.adresse,
        email: createUserRequestDto.email ?? null,
      }
    });
  }

  findAll() {
    return this.prisma.userRequest.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} userRequest`;
  }

  update(id: number, updateUserRequestDto: UpdateUserRequestDto) {
    return `This action updates a #${id} userRequest`;
  }

  remove(id: number) {
    return `This action removes a #${id} userRequest`;
  }
}
