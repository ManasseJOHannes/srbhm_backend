import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { SaveInventaireDto } from './dto/save-inventaire.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ROLES_LECTURE: readonly Role[] = [
  Role.ADMIN,
  Role.COMPTABLE,
  Role.DEPOSITEUR_COMPTABLE,
];

@Injectable()
export class InventaireService {
  constructor(private readonly prisma: PrismaService) {}

  private async chargerExercice(exerciceId: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!ROLES_LECTURE.includes(user.role)) {
      throw new ForbiddenException("Accès à l'inventaire refusé");
    }
    const exercice = await this.prisma.exercice.findUnique({
      where: { id: exerciceId },
      include: {
        soa: true,
        compteMatiere: {
          include: {
            details: { include: { article: { include: { nomenclature: true } } } },
          },
        },
        mouvements: true,
        inventaire: { include: { lignes: true } },
      },
    });
    if (
      !exercice ||
      (user.role === Role.DEPOSITEUR_COMPTABLE &&
        exercice.soaId !== user.soaId)
    ) {
      throw new NotFoundException('Exercice introuvable pour cet utilisateur');
    }
    return exercice;
  }

  async obtenir(exerciceId: number, userId: number) {
    const exercice = await this.chargerExercice(exerciceId, userId);
    const lignesEnregistrees = new Map(
      (exercice.inventaire?.lignes ?? []).map((ligne) => [
        `${ligne.articleId}:${Number(ligne.prixUnitaire).toFixed(2)}`,
        ligne,
      ]),
    );
    // Observations des mouvements regroupées par article × prix (R7).
    const observationsMouvements = new Map<string, string[]>();
    for (const mouvement of exercice.mouvements ?? []) {
      const texte = (mouvement.observation ?? '').trim();
      if (!texte) continue;
      const cle = `${mouvement.articleId}:${Number(mouvement.prixUnitaire).toFixed(2)}`;
      const liste = observationsMouvements.get(cle) ?? [];
      if (!liste.includes(texte)) liste.push(texte);
      observationsMouvements.set(cle, liste);
    }
    const lignes = (exercice.compteMatiere?.details ?? []).map((detail) => {
      const theorique =
        Number(detail.existantDebut) +
        Number(detail.entrees) -
        Number(detail.sorties);
      const cle = `${detail.articleId}:${Number(detail.prixUnitaire).toFixed(2)}`;
      const physique = lignesEnregistrees.get(cle)?.quantitePhysique;
      const ecart =
        physique === undefined ? null : Number(physique) - theorique;
      const observations = [
        ...(detail.observation?.trim() ? [detail.observation.trim()] : []),
        ...(observationsMouvements.get(cle) ?? []),
      ];
      return {
        articleId: detail.articleId,
        designation: detail.article.designation,
        unite: detail.article.unite,
        nomenclatureCode: detail.article.nomenclature.code,
        nomenclatureLibelle: detail.article.nomenclature.libelle,
        folioGrandLivre: detail.folioGrandLivre,
        prixUnitaire: detail.prixUnitaire,
        existantDebut: detail.existantDebut,
        entrees: detail.entrees,
        sorties: detail.sorties,
        resteTheorique: theorique,
        valeurTheorique: theorique * Number(detail.prixUnitaire),
        decomptePhysique: physique ?? null,
        ecart,
        observations,
        avertissements:
          ecart !== null && ecart !== 0
            ? [`Écart de ${ecart} entre le décompte physique et le stock théorique`]
            : [],
      };
    });
    lignes.sort(
      (a, b) =>
        a.nomenclatureCode.localeCompare(b.nomenclatureCode) ||
        a.designation.localeCompare(b.designation) ||
        Number(a.prixUnitaire) - Number(b.prixUnitaire),
    );
    const avertissements = lignes.flatMap((ligne) =>
      ligne.avertissements.map(
        (message) => `${ligne.designation} : ${message}`,
      ),
    );
    return {
      inventaireId: exercice.inventaire?.id ?? null,
      exercice: {
        id: exercice.id,
        annee: exercice.annee,
        dateDebut: exercice.dateDebut,
        dateFin: exercice.dateFin,
        statut: exercice.statut,
        soa: exercice.soa,
      },
      dateInventaireEnregistre:
        exercice.inventaire?.dateInventaire ?? null,
      coherent: avertissements.length === 0,
      avertissements,
      lignes,
    };
  }

  async enregistrer(exerciceId: number, userId: number, dto: SaveInventaireDto) {
    const exercice = await this.chargerExercice(exerciceId, userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new ForbiddenException('Seul le dépositaire-comptable peut saisir');
    }
    if (exercice.statut === 'CLOTURE') {
      throw new ForbiddenException('Cet exercice est clôturé');
    }
    const date = new Date(dto.dateInventaire);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Date d'inventaire invalide");
    }
    if (date < exercice.dateDebut || date > exercice.dateFin) {
      throw new BadRequestException(
        "La date d'inventaire doit appartenir à l'exercice",
      );
    }
    const cles = new Set<string>();
    for (const ligne of dto.lignes) {
      const cle = `${ligne.articleId}:${Number(ligne.prixUnitaire).toFixed(2)}`;
      if (cles.has(cle)) {
        throw new BadRequestException(
          'Ligne en double pour cet article et ce prix',
        );
      }
      cles.add(cle);
      const detail = (exercice.compteMatiere?.details ?? []).find(
        (candidate) =>
          candidate.articleId === ligne.articleId &&
          Number(candidate.prixUnitaire) === Number(ligne.prixUnitaire),
      );
      if (!detail) {
        throw new BadRequestException(
          'Article/prix absent du compte matière',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const inventaire = await tx.inventaire.upsert({
        where: { exerciceId },
        create: { exerciceId, dateInventaire: date },
        update: { dateInventaire: date },
      });
      await tx.ligneInventaire.deleteMany({
        where: { inventaireId: inventaire.id },
      });
      for (const ligne of dto.lignes) {
        await tx.ligneInventaire.create({
          data: {
            inventaireId: inventaire.id,
            articleId: ligne.articleId,
            prixUnitaire: ligne.prixUnitaire,
            quantitePhysique: ligne.quantitePhysique,
          },
        });
      }
    });

    return this.obtenir(exerciceId, userId);
  }
}
