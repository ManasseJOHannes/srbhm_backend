import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserRequestDto } from './dto/create-user-request.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { RequestStatus } from '@prisma/client';
import { RejectUserRequestDto } from './dto/reject-user-request.dto.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}
  private generateTemporaryPassword(): string {
    const randomNumber = Math.floor(1000 + Math.random() * 9000);

    return `srbHM${randomNumber}`
  }
  private async checkRequestDataExists(request: any) {
      // 2. Vérifier les demandes existantes
      const existingRequest = await this.prisma.userRequest.findFirst({
        where: {
          status: {
            in: [
              RequestStatus.PENDING,
              RequestStatus.APPROVED,
            ],
          },
          OR: [
            { imatricule: request.imatricule },
            { cin: request.cin },
            { telephone: request.telephone },
            ...(request.email
              ? [{ email: request.email }]
              : []),
          ],
        },
        select: {
          imatricule: true,
          cin: true,
          telephone: true,
          email: true,
        },
      });

      if (existingRequest) {
        if (existingRequest.imatricule === request.imatricule) {
          throw new ConflictException(
            `Une demande avec l'immatricule ${request.imatricule} existe déjà.`,
          );
        }

        if (existingRequest.cin === request.cin) {
          throw new ConflictException(
            `Une demande avec le CIN ${request.cin} existe déjà.`,
          );
        }

        if (existingRequest.telephone === request.telephone) {
          throw new ConflictException(
            `Une demande avec le numéro téléphone ${request.telephone} existe déjà.`,
          );
        }

        if (
          request.email &&
          existingRequest.email === request.email
        ) {
          throw new ConflictException(
            `Une demande avec l'email ${request.email} existe déjà.`,
          );
        }
      }
  }
  private async checkUserDataExists(request: any) {
    // 1. Vérifier si les données existent déjà dans User
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { imatricule: request.imatricule },
          { cin: request.cin },
          { telephone: request.telephone },
          ...(request.email
            ? [{ email: request.email }]
            : []),
        ],
      },
      select: {
        imatricule: true,
        cin: true,
        telephone: true,
        email: true,
      },
    });

    if (existingUser) {
      if (existingUser.imatricule === request.imatricule) {
        throw new ConflictException(
          `L'immatricule ${request.imatricule} est déjà utilisé.`,
        );
      }

      if (existingUser.cin === request.cin) {
        throw new ConflictException(
          `Le CIN ${request.cin} est déjà utilisé.`,
        );
      }

      if (existingUser.telephone === request.telephone) {
        throw new ConflictException(
          `Le numéro téléphone ${request.telephone} est déjà utilisé.`,
        );
      }

      if (
        request.email &&
        existingUser.email === request.email
      ) {
        throw new ConflictException(
          `L'email ${request.email} est déjà utilisé.`,
        );
      }
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
          soaId: request.soaId,
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
    await this.checkUserDataExists(createUserRequestDto);
    await this.checkRequestDataExists(createUserRequestDto);

    const soa = await this.prisma.sOA.findUnique({
      where: {
        id: createUserRequestDto.soaId,
      },
    });

    if (!soa) {
      throw new NotFoundException("SOA introuvable");
    }

    if (!soa.actif) {
      throw new BadRequestException("Ce SOA n'est pas actif");
    }

    return this.prisma.userRequest.create({
      data: {
        imatricule: createUserRequestDto.imatricule,
        nom: createUserRequestDto.nom,
        prenom: createUserRequestDto.prenom,
        cin: createUserRequestDto.cin,
        telephone: createUserRequestDto.telephone,
        soaId: createUserRequestDto.soaId,
        role: createUserRequestDto.role,
        adresse: createUserRequestDto.adresse,
        email: createUserRequestDto.email ?? null,
      },
      include: {
        soa: true,
      },
    }).then((created) => {
      // Notification admin par email, en tâche de fond : ne bloque jamais la réponse.
      this.mailService
        .sendNewUserRequestNotification(created)
        .catch((err) =>
          console.warn('[UserRequests] Notification email échouée :', err),
        );
      return created;
    });
  }

  findAll() {
    return this.prisma.userRequest.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        soa: true,
      },
    });
  }

  async findOne(id: number) {
    const request = await this.prisma.userRequest.findUnique({
      where: {id},
      include: {
        soa: true,
      },
    })
    if(!request) {
      throw new NotFoundException("Demande introuvable");
    }
    return request;
  }
}