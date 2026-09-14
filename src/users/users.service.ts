import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        imatricule: createUserDto.imatricule,
        nom: createUserDto.nom,
        prenom: createUserDto.prenom,
        cin: createUserDto.cin,
        telephone: createUserDto.telephone,
        service: createUserDto.service,
        role: createUserDto.role,
        adresse: createUserDto.adresse,
        email: createUserDto.email,
        password: createUserDto.password,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
