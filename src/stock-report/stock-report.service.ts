import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const ROLES_LECTURE: readonly Role[] = [
  Role.ADMIN,
  Role.COMPTABLE,
  Role.DEPOSITEUR_COMPTABLE,
];

@Injectable()
export class StockReportService {
  constructor(private readonly prisma: PrismaService) {}

  async simuler(soaId: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!ROLES_LECTURE.includes(user.role)) {
      throw new ForbiddenException('Accès au rapport refusé');
    }
    if (user.role === Role.DEPOSITEUR_COMPTABLE && user.soaId !== soaId) {
      throw new NotFoundException('SOA introuvable pour cet utilisateur');
    }
    const soa = await this.prisma.sOA.findUnique({ where: { id: soaId } });
    if (!soa) throw new NotFoundException('SOA introuvable');

    const exercices = await this.prisma.exercice.findMany({
      where: { soaId },
      include: {
        compteMatiere: {
          include: { details: { include: { article: true } } },
        },
        mouvements: {
          select: {
            articleId: true,
            prixUnitaire: true,
            quantite: true,
            type: true,
          },
        },
      },
      orderBy: { annee: 'asc' },
    });

    let negatifs = 0;
    const lignes = exercices.flatMap((exercice) => {
      const sortiesAnnee = new Map<string, number>();
      for (const mouvement of exercice.mouvements ?? []) {
        if (mouvement.type !== 'SORTIE') continue;
        const cle = `${mouvement.articleId}:${Number(mouvement.prixUnitaire).toFixed(2)}`;
        sortiesAnnee.set(
          cle,
          (sortiesAnnee.get(cle) ?? 0) + Number(mouvement.quantite),
        );
      }
      return (exercice.compteMatiere?.details ?? []).map((detail) => {
        const cle = `${detail.articleId}:${Number(detail.prixUnitaire).toFixed(2)}`;
        const sorties = sortiesAnnee.get(cle) ?? 0;
        const stockFinal =
          Number(detail.existantDebut) +
          Number(detail.entrees) -
          sorties;
        const stockNegatif = stockFinal < 0;
        if (stockNegatif) negatifs += 1;
        return {
          exerciceId: exercice.id,
          annee: exercice.annee,
          articleId: detail.articleId,
          designation: detail.article.designation,
          unite: detail.article.unite,
          prixUnitaire: detail.prixUnitaire,
          stockInitial: detail.existantDebut,
          entrees: detail.entrees,
          sorties,
          stockFinal,
          stockNegatif,
        };
      });
    });

    return {
      soaId,
      lectureSeule: true as const,
      avertissement:
        negatifs > 0
          ? `${negatifs} ligne(s) en stock négatif à vérifier`
          : 'Aucune anomalie détectée',
      exercices: exercices.map((exercice) => ({
        exerciceId: exercice.id,
        annee: exercice.annee,
      })),
      lignes,
    };
  }
}
