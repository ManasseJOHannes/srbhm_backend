import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateUserRequestDto } from './dto/create-user-request.dto.js';
import { UpdateUserRequestDto } from './dto/update-user-request.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {RequestStatus} from '@prisma/client'
import { ApproveUserRequestDto } from './dto/ApproveUserRequestDto.js';
import * as bcrypt from 'bcrypt'

@Injectable()
export class UserRequestsService {
  constructor(private readonly prisma:PrismaService){}
  async approve(
    id:number,
    approveUserRequestDto: ApproveUserRequestDto,
  ) {
    const request = await this.prisma.userRequest.findUnique({
      where: {
        id,
      },
    });
    if (!request) {
      throw new NotFoundException('demande introuvable');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        'Cette demande a déjà été traité'
      );
    }

    const hashedPassword = await bcrypt.hash(
      approveUserRequestDto.password,
      10,
    );
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          imatricule: request.imatricule,
          nom: request.nom,
          prenom: request.prenom,
          cin: request.cin,
          telephone: request.telephone,
          service: request.service,
          role: request.role,
          adresse: request.adresse,
          email: request.email,
          password: hashedPassword,
        },
        omit:{
          password:true
        }
      });

      await tx.userRequest.update({
        where:{
          id:request.id
        },
        data: {
          status: RequestStatus.APPROVED,
        }
      });
      return {
        message : 'Demande approuvée avec ssuccès',
        user,
      }
    })
  }
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
