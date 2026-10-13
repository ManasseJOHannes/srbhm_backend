import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createArticleDto: CreateArticleDto) {
    const nomenclature = await this.prisma.nomenclature.findUnique({
      where: { id: createArticleDto.nomenclatureId },
    });
    if (!nomenclature) {
      throw new NotFoundException('Nomenclature introuvable');
    }
    return this.prisma.article.create({
      data: {
        designation: createArticleDto.designation,
        unite: createArticleDto.unite,
        nomenclatureId: createArticleDto.nomenclatureId,
      },
      include: { nomenclature: true },
    });
  }

  async findAll() {
    return this.prisma.article.findMany({
      include: { nomenclature: true },
      orderBy: { designation: 'asc' },
    });
  }

  async findOne(id: number) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: { nomenclature: true },
    });
    if (!article) {
      throw new NotFoundException(`Article avec l'id ${id} introuvable`);
    }
    return article;
  }

  async update(id: number, updateArticleDto: UpdateArticleDto) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article avec l'id ${id} introuvable`);
    }
    if (updateArticleDto.nomenclatureId) {
      const nomenclature = await this.prisma.nomenclature.findUnique({
        where: { id: updateArticleDto.nomenclatureId },
      });
      if (!nomenclature) {
        throw new NotFoundException('Nomenclature introuvable');
      }
    }
    return this.prisma.article.update({
      where: { id },
      data: updateArticleDto,
      include: { nomenclature: true },
    });
  }

  async remove(id: number) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        _count: { select: { details: true, mouvements: true } },
      },
    });
    if (!article) {
      throw new NotFoundException(`Article avec l'id ${id} introuvable`);
    }
    if (article._count.details > 0 || article._count.mouvements > 0) {
      throw new ConflictException(
        'Suppression refusée : cet article est utilisé dans la comptabilité',
      );
    }
    return this.prisma.article.delete({ where: { id } });
  }
}
