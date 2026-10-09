import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CreateSoaDto } from './dto/create-soa.dto.js';
import { UpdateSoaDto } from './dto/update-soa.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ROLES_AUTORISES_LECTURE_SOA: readonly Role[] = [
  Role.ADMIN,
  Role.COMPTABLE,
  Role.DEPOSITEUR_COMPTABLE,
];

@Injectable()
export class SoaService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createSoaDto: CreateSoaDto) {
    const existingSoa = await this.prisma.sOA.findUnique({
      where: {
        code: createSoaDto.code,
      }
    })
    if (existingSoa) {
      throw new ConflictException(
        `Le code SOA ${createSoaDto.code} existe déjà`
      )
    }
    return this.prisma.sOA.create({
      data: {
        code: createSoaDto.code,
        libelle: createSoaDto.libelle,
        description: createSoaDto.description,
        actif: createSoaDto.actif ?? true
      }
    });
  }

  async findActive() {
    return this.prisma.sOA.findMany({
      where: { actif: true },
      select: { id: true, code: true, libelle: true, actif: true },
      orderBy: { code: 'asc' },
    });
  }

  async findAll(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!ROLES_AUTORISES_LECTURE_SOA.includes(user.role)) {
      throw new ForbiddenException('Accès aux SOA refusé');
    }

    return this.prisma.sOA.findMany({
      where: user.role === Role.DEPOSITEUR_COMPTABLE
        ? { id: user.soaId ?? -1 }
        : undefined,
      orderBy: {
        code: 'asc'
      }
    });
  }

  async findOne(id: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!ROLES_AUTORISES_LECTURE_SOA.includes(user.role)) {
      throw new ForbiddenException('Accès aux SOA refusé');
    }
    if (user.role === Role.DEPOSITEUR_COMPTABLE && user.soaId !== id) {
      throw new NotFoundException(`SOA avec l'id ${id} introuvable`);
    }

    const soa = await this.prisma.sOA.findUnique({
      where: {
        id,
      }
    })
    if (!soa) {
      throw new NotFoundException(
        `SOA avec l'id ${id} introuvable`
      )
    }
    return soa;
  }

  async update(id: number, updateSoaDto: UpdateSoaDto) {
    const soa = await this.prisma.sOA.findUnique({ where: { id } });
    if (!soa) throw new NotFoundException(`SOA avec l'id ${id} introuvable`);
    if (updateSoaDto.code){
      const existingSoa = await this.prisma.sOA.findFirst({
        where:{
          code:updateSoaDto.code,
          NOT: {
            id,
          }
        }
      })
      if (existingSoa){
        throw new ConflictException(
          `Le code SOA ${updateSoaDto.code} existe déjà`
        )
      }
    }
    return this.prisma.sOA.update({
      where: {
        id,
      },
      data: updateSoaDto,
    });
  }

  async remove(id: number) {
    const soa = await this.prisma.sOA.findUnique({ where: { id } });
    if (!soa) throw new NotFoundException(`SOA avec l'id ${id} introuvable`);
    return this.prisma.sOA.delete({
      where:{
        id
      }
    });
  }
}
