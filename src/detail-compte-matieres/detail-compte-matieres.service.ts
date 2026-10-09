import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDetailCompteMatiereDto } from './dto/create-detail-compte-matiere.dto.js';
import { Role } from '@prisma/client';

@Injectable()
export class DetailCompteMatieresService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    compteMatiereId: number,
    dto: CreateDetailCompteMatiereDto,
    userId: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        soaId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new BadRequestException(
        'Seul un dépositaire-comptable peut créer un détail',
      );
    }

    const compteMatiere = await this.prisma.compteMatiere.findUnique({
      where: { id: compteMatiereId },
      include: { exercice: true },
    });

    if (!compteMatiere) {
      throw new NotFoundException('Compte Matière introuvable');
    }

    if (compteMatiere.exercice.soaId !== user.soaId) {
      throw new NotFoundException('Compte Matière introuvable');
    }

    const currentYear = new Date().getFullYear();

    if (compteMatiere.exercice.annee >= currentYear) {
      throw new BadRequestException(
        'Les détails du Compte Matière concernent uniquement une ancienne année',
      );
    }

    const article = await this.prisma.article.findUnique({
      where: { id: dto.articleId },
    });

    if (!article) {
      throw new NotFoundException('Article introuvable');
    }

    const quantiteInitiale = dto.existantDebut ?? 0;

    if (quantiteInitiale < 0) {
      throw new BadRequestException(
        'La quantité initiale ne peut pas être négative',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const detail = await tx.detailCompteMatiere.create({
        data: {
          compteMatiereId,
          articleId: dto.articleId,
          folioGrandLivre: dto.folioGrandLivre,
          prixUnitaire: dto.prixUnitaire,
          existantDebut: quantiteInitiale,
          observation: dto.observation,
        },
        include: {
          article: {
            include: { nomenclature: true },
          },
          compteMatiere: {
            include: {
              exercice: {
                include: { soa: true },
              },
            },
          },
        },
      });

      if (quantiteInitiale > 0) {
        await tx.lotStock.create({
          data: {
            articleId: dto.articleId,
            exerciceId: compteMatiere.exerciceId,
            typeOrigine: 'STOCK_INITIAL',
            detailCompteMatiereId: detail.id,
            dateOrigine: new Date(
              Date.UTC(compteMatiere.exercice.annee, 0, 1),
            ),
            quantiteInitiale: quantiteInitiale,
            quantiteRestante: quantiteInitiale,
            prixUnitaire: dto.prixUnitaire,
          },
        });
      }

      return detail;
    });
  }


  async findAll(
    compteMatiereId: number,
    userId: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        role: true,
        soaId: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Utilisateur introuvable',
      );
    }

    const compteMatiere =
      await this.prisma.compteMatiere.findUnique({
        where: {
          id: compteMatiereId,
        },
        include: {
          exercice: true,
        },
      });

    if (!compteMatiere) {
      throw new NotFoundException(
        'Compte Matière introuvable',
      );
    }

    if (
      user.role === Role.DEPOSITEUR_COMPTABLE &&
      compteMatiere.exercice.soaId !== user.soaId
    ) {
      throw new NotFoundException(
        'Compte Matière introuvable',
      );
    }

    return this.prisma.detailCompteMatiere.findMany({
      where: {
        compteMatiereId,
      },
      include: {
        article: {
          include: {
            nomenclature: true,
          },
        },
      },
      orderBy: [
        {
          article: {
            nomenclature: {
              code: 'asc',
            },
          },
        },
        {
          article: {
            designation: 'asc',
          },
        },
        {
          folioGrandLivre: 'asc',
        },
      ],
    });
  }
}