import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateNomenclatureDto } from './dto/create-nomenclature.dto.js';
import { UpdateNomenclatureDto } from './dto/update-nomenclature.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NomenclaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createNomenclatureDto: CreateNomenclatureDto) {
    const existing = await this.prisma.nomenclature.findUnique({
      where: { code: createNomenclatureDto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Le code nomenclature ${createNomenclatureDto.code} existe déjà`,
      );
    }
    return this.prisma.nomenclature.create({
      data: {
        ...createNomenclatureDto,
        actif: createNomenclatureDto.actif ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.nomenclature.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: number) {
    const nomenclature = await this.prisma.nomenclature.findUnique({
      where: { id },
      include: { articles: true },
    });
    if (!nomenclature) {
      throw new NotFoundException(`Nomenclature avec l'id ${id} introuvable`);
    }
    return nomenclature;
  }

  async update(id: number, updateNomenclatureDto: UpdateNomenclatureDto) {
    const nomenclature = await this.prisma.nomenclature.findUnique({
      where: { id },
    });
    if (!nomenclature) {
      throw new NotFoundException(`Nomenclature avec l'id ${id} introuvable`);
    }
    if (updateNomenclatureDto.code) {
      const existing = await this.prisma.nomenclature.findFirst({
        where: { code: updateNomenclatureDto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `Le code nomenclature ${updateNomenclatureDto.code} existe déjà`,
        );
      }
    }
    return this.prisma.nomenclature.update({
      where: { id },
      data: updateNomenclatureDto,
    });
  }

  async remove(id: number) {
    const nomenclature = await this.prisma.nomenclature.findUnique({
      where: { id },
      include: { _count: { select: { articles: true } } },
    });
    if (!nomenclature) {
      throw new NotFoundException(`Nomenclature avec l'id ${id} introuvable`);
    }
    if (nomenclature._count.articles > 0) {
      throw new ConflictException(
        'Suppression refusée : des articles utilisent cette nomenclature',
      );
    }
    return this.prisma.nomenclature.delete({ where: { id } });
  }
}
