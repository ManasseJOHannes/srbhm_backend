import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { CreateAdminUserDto } from './dto/create-admin-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateAdminUserDto) {
    if (createUserDto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: {email: createUserDto.email}
      })
      if (existingEmail) {
        throw new ConflictException(
          `User with email ${createUserDto.email} already exist`
        )
      }
    }

    if (createUserDto.imatricule) {
      const existingImatricule = await this.prisma.user.findUnique({
        where: {imatricule: createUserDto.imatricule}
      })
      if (existingImatricule) {
        throw new ConflictException(
          `User with immatricule ${createUserDto.imatricule} already exist`
        )
      }
    }

    if (createUserDto.telephone) {
      const existingTelephone = await this.prisma.user.findUnique({
        where: {telephone: createUserDto.telephone}
      })
      if (existingTelephone) {
        throw new ConflictException(
          `User with telephone ${createUserDto.telephone} already exist`
        )
      }
    }

    if (createUserDto.cin) {
      const existingCin = await this.prisma.user.findUnique({
        where: {cin: createUserDto.cin}
      })
      if (existingCin) {
        throw new ConflictException(
          `User with cin ${createUserDto.cin} already exist`
        )
      }
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
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
        password: hashedPassword,
      },
      select: {
        id: true,
        imatricule: true,
        nom: true,
        prenom: true,
        cin: true,
        telephone: true,
        service: true,
        role: true,
        adresse: true,
        email: true,
        createdAt: true,
        updatedAt: true
      },
    });
  }

  async findAll(page:number, limit: number, search?: string, role?: string) {
    const skip = (page - 1) * limit;

    const where = { 
      ...(search && {
        OR: [
          { nom: { contains: search, mode: 'insensitive' as const} },
          { prenom: { contains: search, mode: 'insensitive' as const} },
          { email: { contains: search, mode: 'insensitive' as const} },
          { imatricule: { contains: search, mode: 'insensitive' as const} },
          { cin: { contains: search, mode: 'insensitive' as const} },
          { telephone: { contains: search, mode: 'insensitive' as const} },
          { service: { contains: search, mode: 'insensitive' as const} },
          { adresse: { contains: search, mode: 'insensitive' as const} },
        ],
      }),
      ...(role && {
        role: role as Role,
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          imatricule: true,
          nom: true,  
          prenom: true,
          cin: true,
          telephone: true,
          service: true,
          role: true,
          adresse: true,
          email: true,
        },
      }),
      this.prisma.user.count({where}),
    ]);
    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
     };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        imatricule: true,
        nom: true,
        prenom: true,
        cin: true,
        telephone: true,
        service: true,
        role: true,
        adresse: true,
        email: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }     
    return user;  
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id); // Check if the user exists
    if (updateUserDto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(`User with email ${updateUserDto.email} already exists`);
      }
    }
    if (updateUserDto.imatricule) {
      const existingImatricule = await this.prisma.user.findUnique({
        where: { imatricule: updateUserDto.imatricule },
      });
      if (existingImatricule && existingImatricule.id !== id) {
        throw new ConflictException(`User with imatricule ${updateUserDto.imatricule} already exists`);
      }
    }if (updateUserDto.cin) {
      const existingCin = await this.prisma.user.findUnique({
        where: { cin: updateUserDto.cin },
      });
      if (existingCin && existingCin.id !== id) {
        throw new ConflictException(`User with cin ${updateUserDto.cin} already exists`);
      }
    }if (updateUserDto.telephone) {
      const existingTelephone = await this.prisma.user.findUnique({
        where: { telephone: updateUserDto.telephone},
      })
      if (existingTelephone && existingTelephone.id !== id){
        throw new ConflictException(
          `User with telephone ${updateUserDto.telephone} already exists`
        )
      }
    }
    const data: any = {
      imatricule: updateUserDto.imatricule,
      nom: updateUserDto.nom,
      prenom: updateUserDto.prenom,
      cin: updateUserDto.cin,
      telephone: updateUserDto.telephone,
      service: updateUserDto.service,
      role: updateUserDto.role,
      adresse: updateUserDto.adresse,
      email: updateUserDto.email,
    };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        imatricule: true,
        nom: true,
        prenom: true,
        cin: true,
        telephone: true,
        service: true,
        role: true,
        adresse: true,
        email: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Check if the user exists
    await this.prisma.user.delete({
      where: { id },
    });
    return { message: `User with ID ${id} has been deleted` };
  }
}
