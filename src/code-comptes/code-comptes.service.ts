import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateParagrapheDto } from './dto/create-paragraphe.dto.js';
import { UpdateParagrapheDto } from './dto/update-paragraphe.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

const INCLUDE_PARAGRAPHE = {
  article: { include: { chapitre: true } },
  nomenclature: true,
} as const;

@Injectable()
export class CodeComptesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrouve (ou crée) le chapitre et l'article budgétaire déduits du code
   * compte : 2 premiers chiffres = chapitre, 3 premiers = article.
   */
  private async resoudreArticle(code: string) {
    const chapitreCode = code.slice(0, 2);
    const articleCode = code.slice(0, 3);
    const chapitre = await this.prisma.chapitre.upsert({
      where: { chapitre: chapitreCode },
      update: {},
      create: { chapitre: chapitreCode },
    });
    return this.prisma.codeArticle.upsert({
      where: {
        chapitreId_article: { chapitreId: chapitre.id, article: articleCode },
      },
      update: {},
      create: { chapitreId: chapitre.id, article: articleCode },
    });
  }

  private async verifierNomenclature(nomenclatureId?: number | null) {
    if (nomenclatureId === undefined || nomenclatureId === null) return;
    const nomenclature = await this.prisma.nomenclature.findUnique({
      where: { id: nomenclatureId },
    });
    if (!nomenclature) {
      throw new NotFoundException('Nomenclature introuvable');
    }
  }

  async create(dto: CreateParagrapheDto) {
    const existant = await this.prisma.paragraphe.findUnique({
      where: { code: dto.code },
    });
    if (existant) {
      throw new ConflictException(`Le code compte ${dto.code} existe déjà`);
    }
    await this.verifierNomenclature(dto.nomenclatureId);
    const article = await this.resoudreArticle(dto.code);
    return this.prisma.paragraphe.create({
      data: {
        code: dto.code,
        libelle: dto.libelle,
        articleId: article.id,
        nomenclatureId: dto.nomenclatureId ?? null,
      },
      include: INCLUDE_PARAGRAPHE,
    });
  }

  findAll() {
    return this.prisma.paragraphe.findMany({
      include: INCLUDE_PARAGRAPHE,
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: number) {
    const paragraphe = await this.prisma.paragraphe.findUnique({
      where: { id },
      include: INCLUDE_PARAGRAPHE,
    });
    if (!paragraphe) {
      throw new NotFoundException(`Code compte avec l'id ${id} introuvable`);
    }
    return paragraphe;
  }

  async update(id: number, dto: UpdateParagrapheDto) {
    const paragraphe = await this.prisma.paragraphe.findUnique({
      where: { id },
    });
    if (!paragraphe) {
      throw new NotFoundException(`Code compte avec l'id ${id} introuvable`);
    }
    if (dto.code && dto.code !== paragraphe.code) {
      const existant = await this.prisma.paragraphe.findUnique({
        where: { code: dto.code },
      });
      if (existant) {
        throw new ConflictException(`Le code compte ${dto.code} existe déjà`);
      }
    }
    await this.verifierNomenclature(dto.nomenclatureId);
    const code = dto.code ?? paragraphe.code;
    const article = await this.resoudreArticle(code);
    return this.prisma.paragraphe.update({
      where: { id },
      data: {
        code,
        libelle: dto.libelle ?? paragraphe.libelle,
        articleId: article.id,
        ...(dto.nomenclatureId !== undefined
          ? { nomenclatureId: dto.nomenclatureId }
          : {}),
      },
      include: INCLUDE_PARAGRAPHE,
    });
  }

  async remove(id: number) {
    const paragraphe = await this.prisma.paragraphe.findUnique({
      where: { id },
      include: { _count: { select: { articles: true } } },
    });
    if (!paragraphe) {
      throw new NotFoundException(`Code compte avec l'id ${id} introuvable`);
    }
    if (paragraphe._count.articles > 0) {
      throw new ConflictException(
        'Suppression refusée : des articles utilisent ce code compte',
      );
    }
    return this.prisma.paragraphe.delete({ where: { id } });
  }
}
