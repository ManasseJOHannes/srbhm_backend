import {
  Injectable,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role,TypeMouvement } from '@prisma/client';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createArticleDto: CreateArticleDto) {
    const {
      designation,
      unite,
      nomenclatureId,
    } = createArticleDto;

    const nomenclature =
      await this.prisma.nomenclature.findUnique({
        where: {
          id: nomenclatureId,
        },
      });

    if (!nomenclature) {
      throw new NotFoundException(
        'Nomenclature introuvable',
      );
    }

    if (!nomenclature.actif) {
      throw new NotFoundException(
        'Cette nomenclature est inactive',
      );
    }

    return this.prisma.article.create({
      data: {
        designation,
        unite,
        nomenclatureId,
      },
      include: {
        nomenclature: true,
      },
    });
  }

  async findAll() {
    return this.prisma.article.findMany({
      include: {
        nomenclature: true,
      },
      orderBy: [
        {
          nomenclature: {
            code: 'asc',
          },
        },
        {
          designation: 'asc',
        },
      ],
    });
  }

  async findOne(id: number) {
    const article =
      await this.prisma.article.findUnique({
        where: {
          id,
        },
        include: {
          nomenclature: true,
        },
      });

    if (!article) {
      throw new NotFoundException(
        'Article introuvable',
      );
    }

    return article;
  }

  async update(
    id: number,
    updateArticleDto: UpdateArticleDto,
  ) {
    const article =
      await this.prisma.article.findUnique({
        where: {
          id,
        },
      });

    if (!article) {
      throw new NotFoundException(
        'Article introuvable',
      );
    }

    if (updateArticleDto.nomenclatureId) {
      const nomenclature =
        await this.prisma.nomenclature.findUnique({
          where: {
            id: updateArticleDto.nomenclatureId,
          },
        });

      if (!nomenclature) {
        throw new NotFoundException(
          'Nomenclature introuvable',
        );
      }

      if (!nomenclature.actif) {
        throw new NotFoundException(
          'Cette nomenclature est inactive',
        );
      }
    }

    return this.prisma.article.update({
      where: {
        id,
      },
      data: updateArticleDto,
      include: {
        nomenclature: true,
      },
    });
  }
  async findArticlesDisponiblesSortie(
    exerciceId: number,
    user: { id: number; role: Role},
  ) {
    const exercice =
      await this.prisma.exercice.findUnique({
        where: {
          id: exerciceId,
        },
      });

    if (!exercice) {
      throw new NotFoundException(
        'Exercice introuvable',
      );
    }

    // DEPOSITEUR_COMPTABLE : son SOA uniquement
    if (user.role === Role.DEPOSITEUR_COMPTABLE) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { soaId: true },
      });

      if (!currentUser) {
        throw new NotFoundException('Utilisateur introuvable');
      }

      if (exercice.soaId !== currentUser.soaId) {
        throw new ForbiddenException(
          'Vous ne pouvez pas accéder à cet exercice.',
        );
      }
    }

    // Exercice courant :
    // article ayant déjà au moins une entrée
    if (exercice.annee === new Date().getFullYear()) {
      return this.prisma.article.findMany({
        where: {
          mouvements: {
            some: {
              exerciceId,
              type: TypeMouvement.ENTREE,
            },
          },
        },
        include: {
          nomenclature: true,
        },
        orderBy: [
          {
            nomenclature: {
              code: 'asc',
            },
          },
          {
            designation: 'asc',
          },
        ],
      });
    }

    // Exercice ancien :
    // article déjà présent dans le Compte Matière
    const compteMatiere =
      await this.prisma.compteMatiere.findUnique({
        where: {
          exerciceId,
        },
      });

    if (!compteMatiere) {
      return [];
    }

    return this.prisma.article.findMany({
      where: {
        details: {
          some: {
            compteMatiereId: compteMatiere.id,
          },
        },
      },
      include: {
        nomenclature: true,
      },
      orderBy: [
        {
          nomenclature: {
            code: 'asc',
          },
        },
        {
          designation: 'asc',
        },
      ],
    });
  }
}