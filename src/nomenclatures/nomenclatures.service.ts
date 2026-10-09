import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNomenclatureDto } from './dto/create-nomenclature.dto.js';
import { UpdateNomenclatureDto } from './dto/update-nomenclature.dto.js';

@Injectable()
export class NomenclaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNomenclatureDto) {
    const existing = await this.prisma.nomenclature.findUnique({
      where: {
        code: dto.code,
      },
    });

    if (existing) {
      throw new ConflictException(
        `La nomenclature ${dto.code} existe déjà`,
      );
    }

    return this.prisma.nomenclature.create({
      data: {
        code: dto.code,
        libelle: dto.libelle,
        description: dto.description,
        actif: dto.actif ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.nomenclature.findMany({
      where: {
        actif: true,
      },
      include: {
        articles: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const nomenclature =
      await this.prisma.nomenclature.findUnique({
        where: {
          id,
        },
        include: {
          articles: {
            orderBy: {
              designation: 'asc',
            },
          },
        },
      });

    if (!nomenclature) {
      throw new NotFoundException(
        'Nomenclature introuvable',
      );
    }

    return nomenclature;
  }

  async update(
    id: number,
    dto: UpdateNomenclatureDto,
  ) {
    const nomenclature =
      await this.prisma.nomenclature.findUnique({
        where: {
          id,
        },
      });

    if (!nomenclature) {
      throw new NotFoundException(
        'Nomenclature introuvable',
      );
    }

    if (dto.code && dto.code !== nomenclature.code) {
      const existing =
        await this.prisma.nomenclature.findUnique({
          where: {
            code: dto.code,
          },
        });

      if (existing) {
        throw new ConflictException(
          `La nomenclature ${dto.code} existe déjà`,
        );
      }
    }

    return this.prisma.nomenclature.update({
      where: {
        id,
      },
      data: dto,
    });
  }
}