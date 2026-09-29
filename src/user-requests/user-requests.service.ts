import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserRequestDto } from './dto/create-user-request.dto.js';
import { UpdateUserRequestDto } from './dto/update-user-request.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestStatus } from '@prisma/client';
import { RejectUserRequestDto } from './dto/reject-user-request.dto.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserRequestsService {
  constructor(private readonly prisma: PrismaService) {}
  private generateTemporaryPassword(): string {
    const randomNumber = Math.floor(1000 + Math.random() * 9000);

    return `srbHM${randomNumber}`
  }
  private async checkUserDataExists(request: any) {
    const existingUser = await this.prisma.user.findFirst({
      where:{
        OR:[
          { imatricule: request.imatricule},
          { cin: request.cin},
          { telephone: request.telephone},
          ...(request.email
            ?[{email: request.email}]
            : [])
        ]
      },
      select: {
        imatricule: true,
        cin:true,
        telephone: true,
        email:true,
      }
    })
    if (!existingUser) {
      return;
    }
    if (existingUser.imatricule === request.imatricule) {
      throw new ConflictException(`L'immatricule ${request.imatricule} est déjà utilisé.`,)
    }
    if (existingUser.cin === request.cin) {
      throw new ConflictException(`Le CIN ${request.cin} est déjà utilisé.`,)
    }
    if (existingUser.telephone === request.telephone) {
      throw new ConflictException(`Le numéro Téléphone ${request.telephone} est déjà utilisé`,)
    }
    if (
      request.email && 
      existingUser.email === request.email
    ) {
      throw new ConflictException(`L'email ${request.email} est déjà utilisé.`,)
    }

        const existingRequest = await this.prisma.userRequest.findFirst({
      where:{
        status: {
          in: [RequestStatus.APPROVED, RequestStatus.PENDING],
        },
        OR:[
          { imatricule: request.imatricule},
          { cin: request.cin},
          { telephone: request.telephone},
          ...(request.email
            ?[{email: request.email}]
            : [])
        ]
      },
      select: {
        imatricule: true,
        cin:true,
        telephone: true,
        email:true,
      }
    })
    if (!existingRequest) {
      return;
    }
    if (existingRequest.imatricule === request.imatricule) {
      throw new ConflictException(`Une demande avec l'immatricule ${request.imatricule} est déjà en attente.`,)
    }
    if (existingRequest.cin === request.cin) {
      throw new ConflictException(`Une demande avec le CIN ${request.cin} est déjà en attente.`,)
    }
    if (existingRequest.telephone === request.telephone) {
      throw new ConflictException(`LUne demande avec le numéro ${request.telephone} est déjà en attente.`,)
    }
    if (
      request.email && 
      existingRequest.email === request.email
    ) {
      throw new ConflictException(`Une demande avec l'email ${request.email} est déjà en attente.`,)
    }
  }




  async approve(id: number) {
    const request = await this.prisma.userRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Demande introuvable');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }
    await this.checkUserDataExists(request);
    const temporaryPassword = this.generateTemporaryPassword()
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create the user
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
        omit: {
          password: true,
        },
      });

      // 2. Update the request status to APPROVED
      const updatedRequest =await tx.userRequest.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.APPROVED,
        },
      });

      return {
        
        user,
        updatedRequest,
      };
    });
    return {
      message: 'Demande approuvée avec succès',
      temporaryPassword,
      user: result.user,
      request: result.updatedRequest ,
    }
  }

  async reject(id: number, rejectUserRequestDto: RejectUserRequestDto) {
    const request = await this.prisma.userRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Demande introuvable');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }

    const rejectedRequest = await this.prisma.userRequest.update({
      where: { id: request.id },
      data: {
        status: RequestStatus.REJECTED,
        rejectionReason: rejectUserRequestDto.reason,
      },
    });

    return {
      message: 'Demande rejetée avec succès',
      request: rejectedRequest,
    };
  }

  async create(createUserRequestDto: CreateUserRequestDto) {
    await this.checkUserDataExists(createUserRequestDto)
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
      },
    });
  }

  findAll() {
    return this.prisma.userRequest.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const request = await this.prisma.userRequest.findUnique({
      where: {id},
    })
    if(!request) {
      throw new NotFoundException("Demande introuvable");
    }
    return request;
  }

  update(id: number, updateUserRequestDto: UpdateUserRequestDto) {
    return this.prisma.userRequest.update({
      where: { id },
      data: updateUserRequestDto,
    });
  }

  remove(id: number) {
    return this.prisma.userRequest.delete({ where: { id } });
  }
}