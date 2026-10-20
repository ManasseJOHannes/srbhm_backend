import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

const INCLUDE_ARTICLE = {
  nomenclature: true,
  paragraphe: { include: { article: { include: { chapitre: true } } } },
} as const;

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Un article ne peut porter qu'un code compte (paragraphe) associé à sa
   * nomenclature (association paramétrée dans /codes-compte).
   */
  private async verifierParagraphe(
    nomenclatureId: number,
    paragrapheId: number,
  ) {
    const paragraphe = await this.prisma.paragraphe.findUnique({
      where: { id: paragrapheId },
    });
    if (!paragraphe) {
      throw new NotFoundException('Code compte introuvable');
    }
    if (paragraphe.nomenclatureId !== nomenclatureId) {
      throw new BadRequestException(
        "Ce code compte n'est pas associé à la nomenclature choisie",
      );
    }
  }

  async create(createArticleDto: CreateArticleDto) {
    const nomenclature = await this.prisma.nomenclature.findUnique({
      where: { id: createArticleDto.nomenclatureId },
    });
    if (!nomenclature) {
      throw new NotFoundException('Nomenclature introuvable');
    }
    await this.verifierParagraphe(
      createArticleDto.nomenclatureId,
      createArticleDto.paragrapheId,
    );
    return this.prisma.article.create({
      data: {
        designation: createArticleDto.designation,
        unite: createArticleDto.unite.trim().toLowerCase(),
        nomenclatureId: createArticleDto.nomenclatureId,
        paragrapheId: createArticleDto.paragrapheId,
      },
      include: INCLUDE_ARTICLE,
    });
  }

  async findAll() {
    return this.prisma.article.findMany({
      include: INCLUDE_ARTICLE,
      orderBy: { designation: 'asc' },
    });
  }

  async findOne(id: number) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: INCLUDE_ARTICLE,
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
    if (
      updateArticleDto.nomenclatureId !== undefined ||
      updateArticleDto.paragrapheId !== undefined
    ) {
      await this.verifierParagraphe(
        updateArticleDto.nomenclatureId ?? article.nomenclatureId,
        updateArticleDto.paragrapheId ?? article.paragrapheId,
      );
    }
    return this.prisma.article.update({
      where: { id },
      data: {
        ...updateArticleDto,
        ...(updateArticleDto.unite
          ? { unite: updateArticleDto.unite.trim().toLowerCase() }
          : {}),
      },
      include: INCLUDE_ARTICLE,
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
