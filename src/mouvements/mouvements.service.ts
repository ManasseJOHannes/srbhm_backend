import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrigineMouvement, Role, TypeMouvement } from '@prisma/client';
import { CreateMouvementDto } from './dto/create-mouvement.dto.js';
import { recalculerValeursCompte } from '../compte-matieres/compte-matieres.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ROLES_LECTURE: readonly Role[] = [
  Role.ADMIN,
  Role.COMPTABLE,
  Role.DEPOSITEUR_COMPTABLE,
];

@Injectable()
export class MouvementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMouvementDto, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new ForbiddenException('Seul le dépositaire-comptable peut écrire');
    }

    const exercice = await this.prisma.exercice.findUnique({
      where: { id: dto.exerciceId },
    });
    if (!exercice || exercice.soaId !== user.soaId) {
      throw new NotFoundException('Exercice introuvable pour cet utilisateur');
    }
    if (exercice.statut === 'CLOTURE') {
      throw new ForbiddenException('Cet exercice est clôturé');
    }

    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Date de mouvement invalide');
    }
    if (date < exercice.dateDebut || date > exercice.dateFin) {
      throw new BadRequestException(
        `La date doit être comprise entre ${exercice.dateDebut.toISOString().slice(0, 10)} et ${exercice.dateFin.toISOString().slice(0, 10)}`,
      );
    }

    const article = await this.prisma.article.findUnique({
      where: { id: dto.articleId },
    });
    if (!article) {
      throw new NotFoundException('Article introuvable');
    }

    return this.prisma.$transaction(async (tx) => {
      let compte = await tx.compteMatiere.findUnique({
        where: { exerciceId: exercice.id },
      });
      if (!compte) {
        compte = await tx.compteMatiere.create({
          data: { exerciceId: exercice.id },
        });
      }

      let detail = await tx.detailCompteMatiere.findUnique({
        where: {
          compteMatiereId_articleId_prixUnitaire: {
            compteMatiereId: compte.id,
            articleId: dto.articleId,
            prixUnitaire: dto.prixUnitaire,
          },
        },
      });

      if (dto.type === TypeMouvement.SORTIE) {
        // R2 stricte : sorties cumulées ≤ existant de début du détail
        // de l'exercice courant (pas de consommation N-n).
        if (!detail) {
          throw new BadRequestException(
            'Aucun stock de cet article à ce prix sur cet exercice',
          );
        }
        const sortiesCumulees = Number(detail.sorties) + dto.quantite;
        if (sortiesCumulees > Number(detail.existantDebut)) {
          throw new BadRequestException(
            `Sorties cumulées (${sortiesCumulees}) supérieures à l'existant de début (${Number(detail.existantDebut)})`,
          );
        }
        await tx.detailCompteMatiere.update({
          where: { id: detail.id },
          data: { sorties: sortiesCumulees },
        });
      } else {
        // Folio partageable (page du grand livre) : la dernière saisie
        // fait foi, sans contrôle d'unicité.
        if (!detail) {
          detail = await tx.detailCompteMatiere.create({
            data: {
              compteMatiereId: compte.id,
              articleId: dto.articleId,
              prixUnitaire: dto.prixUnitaire,
              existantDebut: 0,
              folioGrandLivre: dto.folioGrandLivre,
            },
          });
        } else if (
          dto.folioGrandLivre !== undefined &&
          dto.folioGrandLivre !== detail.folioGrandLivre
        ) {
          await tx.detailCompteMatiere.update({
            where: { id: detail.id },
            data: { folioGrandLivre: dto.folioGrandLivre },
          });
        }
        await tx.detailCompteMatiere.update({
          where: { id: detail.id },
          data: { entrees: Number(detail.entrees) + dto.quantite },
        });
      }

      const mouvement = await tx.mouvement.create({
        data: {
          type: dto.type,
          date,
          exerciceId: exercice.id,
          articleId: dto.articleId,
          quantite: dto.quantite,
          prixUnitaire: dto.prixUnitaire,
          observation: dto.observation,
        },
        include: {
          article: { include: { nomenclature: true } },
          exercice: { include: { soa: true } },
        },
      });

      await recalculerValeursCompte(tx, compte.id);
      return mouvement;
    });
  }

  async findAll(userId: number, exerciceId?: number) {    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!ROLES_LECTURE.includes(user.role)) {
      throw new ForbiddenException('Accès aux mouvements refusé');
    }
    return this.prisma.mouvement.findMany({
      where: {
        ...(exerciceId ? { exerciceId } : {}),
        exercice:
          user.role === Role.DEPOSITEUR_COMPTABLE
            ? { soaId: user.soaId }
            : undefined,
      },
      include: {
        article: { include: { nomenclature: true } },
        exercice: { include: { soa: true } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(id: number, userId: number) {    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!ROLES_LECTURE.includes(user.role)) {
      throw new ForbiddenException('Accès aux mouvements refusé');
    }
    const mouvement = await this.prisma.mouvement.findUnique({
      where: { id },
      include: {
        article: { include: { nomenclature: true } },
        exercice: { include: { soa: true } },
      },
    });
    if (
      !mouvement ||
      (user.role === Role.DEPOSITEUR_COMPTABLE &&
        mouvement.exercice.soaId !== user.soaId)
    ) {
      throw new NotFoundException('Mouvement introuvable');
    }
    return mouvement;
  }

  async remove(id: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new ForbiddenException(
        'Seul le dépositaire-comptable peut supprimer un mouvement',
      );
    }

    const mouvement = await this.prisma.mouvement.findUnique({
      where: { id },
      include: { exercice: true },
    });
    if (!mouvement || mouvement.exercice.soaId !== user.soaId) {
      throw new NotFoundException('Mouvement introuvable');
    }
    if (mouvement.exercice.statut === 'CLOTURE') {
      throw new ForbiddenException('Cet exercice est clôturé');
    }
    if (mouvement.origine !== OrigineMouvement.MANUEL) {
      throw new BadRequestException(
        'Un mouvement issu du recensement ne peut pas être supprimé',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const compte = await tx.compteMatiere.findUnique({
        where: { exerciceId: mouvement.exerciceId },
      });
      if (!compte) {
        throw new NotFoundException(
          'Compte matière introuvable pour cet exercice',
        );
      }

      const detail = await tx.detailCompteMatiere.findUnique({
        where: {
          compteMatiereId_articleId_prixUnitaire: {
            compteMatiereId: compte.id,
            articleId: mouvement.articleId,
            prixUnitaire: mouvement.prixUnitaire,
          },
        },
      });
      if (!detail) {
        throw new BadRequestException('Détail du compte matière introuvable');
      }

      const quantite = Number(mouvement.quantite);

      if (mouvement.type === TypeMouvement.ENTREE) {
        const nouvellesEntrees = Number(detail.entrees) - quantite;
        if (nouvellesEntrees < 0) {
          throw new BadRequestException(
            'Les entrées du détail deviendraient négatives',
          );
        }
        if (
          Number(detail.existantDebut) + nouvellesEntrees <
          Number(detail.sorties)
        ) {
          throw new BadRequestException(
            'Suppression impossible : les sorties dépasseraient le stock disponible',
          );
        }
        await tx.detailCompteMatiere.update({
          where: { id: detail.id },
          data: { entrees: nouvellesEntrees },
        });
      } else {
        const nouvellesSorties = Number(detail.sorties) - quantite;
        if (nouvellesSorties < 0) {
          throw new BadRequestException(
            'Les sorties du détail deviendraient négatives',
          );
        }
        await tx.detailCompteMatiere.update({
          where: { id: detail.id },
          data: { sorties: nouvellesSorties },
        });
      }

      const supprime = await tx.mouvement.delete({ where: { id } });
      await recalculerValeursCompte(tx, compte.id);
      return supprime;
    });
  }
}
