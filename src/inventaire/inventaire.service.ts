import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrigineMouvement, Role, TypeMouvement } from '@prisma/client';
import { ETAT_MATIERE_DEFAUT } from './etats-matiere.js';
import { SaveInventaireDto } from './dto/save-inventaire.dto.js';
import { UpdateObservationEtatDto } from './dto/update-observation-etat.dto.js';
import { UpsertLigneInventaireDto } from './dto/upsert-ligne-inventaire.dto.js';
import { recalculerValeursCompte } from '../compte-matieres/compte-matieres.service.js';
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
            details: {
              include: {
                article: {
                  include: {
                    nomenclature: true,
                    paragraphe: {
                      include: {
                        article: { include: { chapitre: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        mouvements: {
          select: {
            articleId: true,
            prixUnitaire: true,
            quantite: true,
            type: true,
            observation: true,
          },
        },
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
    return { exercice, user };
  }

  /**
   * Inventaire de l'exercice N seul : son compte contient déjà les
   * articles des exercices avant (restes N-1 reportés en existant de N).
   * R2 stricte : sorties cumulées ≤ existant de début, donc
   * reste = existant + entrees − sorties ne peut pas devenir négatif.
   */
  async obtenir(exerciceId: number, userId: number) {
    const { exercice } = await this.chargerExercice(exerciceId, userId);
    const lignes: {
      detailId: number;
      ligneId: number | null;
      articleId: number;
      designation: string;
      unite: string;
      nomenclatureCode: string;
      nomenclatureLibelle: string;
      chapitreCode: string;
      articleCode: string;
      paragrapheCode: string;
      folioGrandLivre: number | null;
      prixUnitaire: unknown;
      existantDebut: unknown;
      entrees: unknown;
      sorties: unknown;
      resteTheorique: number;
      valeurTheorique: number;
      existantReference: number;
      decomptePhysique: number | null;
      quantiteExcedent: number | null;
      quantiteDeficit: number | null;
      ecart: number | null;
      observationEtat: string;
      observations: string[];
      avertissements: string[];
    }[] = [];
    // Observations des mouvements de l'exercice, par article × prix (R7).
    const observationsMouvements = new Map<string, string[]>();
    for (const mouvement of exercice.mouvements ?? []) {
      const texte = (mouvement.observation ?? '').trim();
      if (!texte) continue;
      const cle = `${mouvement.articleId}:${Number(mouvement.prixUnitaire).toFixed(2)}`;
      const liste = observationsMouvements.get(cle) ?? [];
      if (!liste.includes(texte)) liste.push(texte);
      observationsMouvements.set(cle, liste);
    }
    const lignesEnregistrees = new Map(
      (exercice.inventaire?.lignes ?? []).map((ligne) => [
        `${ligne.articleId}:${Number(ligne.prixUnitaire).toFixed(2)}`,
        ligne,
      ]),
    );
    const avertissements: string[] = [];
    // Flux équilibrés : sorties datées de N sur les détails de N.
    // R2 stricte : sorties cumulées ≤ existant de début, donc le reste
    // reste = existant + entrees − sorties ne peut pas devenir négatif.
    const sortiesAnnee = new Map<string, number>();
    for (const mouvement of exercice.mouvements ?? []) {
      if (mouvement.type !== 'SORTIE') continue;
      const cle = `${mouvement.articleId}:${Number(mouvement.prixUnitaire).toFixed(2)}`;
      sortiesAnnee.set(
        cle,
        (sortiesAnnee.get(cle) ?? 0) + Number(mouvement.quantite),
      );
    }
    for (const detail of exercice.compteMatiere?.details ?? []) {
      const cle = `${detail.articleId}:${Number(detail.prixUnitaire).toFixed(2)}`;
      const sorties = sortiesAnnee.get(cle) ?? 0;
      const theorique =
        Number(detail.existantDebut) +
        Number(detail.entrees) -
        sorties;
      const ligneEnregistree = lignesEnregistrees.get(cle);
      const referenceStockee = ligneEnregistree?.existantReference;
      const existantReference =
        referenceStockee === null || referenceStockee === undefined
          ? theorique
          : Number(referenceStockee);
      const decomptePhysique =
        ligneEnregistree?.quantitePhysique === null ||
        ligneEnregistree?.quantitePhysique === undefined
          ? null
          : Number(ligneEnregistree.quantitePhysique);

      // Les lignes historiques n'ont pas de colonnes explicites : on
      // conserve leur ancien calcul excédent/déficit à partir de l'écart.
      let quantiteExcedent =
        ligneEnregistree?.quantiteExcedent === null ||
        ligneEnregistree?.quantiteExcedent === undefined
          ? null
          : Number(ligneEnregistree.quantiteExcedent);
      let quantiteDeficit =
        ligneEnregistree?.quantiteDeficit === null ||
        ligneEnregistree?.quantiteDeficit === undefined
          ? null
          : Number(ligneEnregistree.quantiteDeficit);
      if (
        ligneEnregistree &&
        referenceStockee === null &&
        decomptePhysique !== null
      ) {
        const ancienEcart = decomptePhysique - existantReference;
        quantiteExcedent = ancienEcart > 0 ? ancienEcart : null;
        quantiteDeficit = ancienEcart < 0 ? -ancienEcart : null;
      }

      const ecart =
        decomptePhysique === null
          ? null
          : decomptePhysique - existantReference;
      const observations = [
        ...(detail.observation?.trim() ? [detail.observation.trim()] : []),
        ...(observationsMouvements.get(cle) ?? []),
      ];
      const ligneAvertissements =
        ecart !== null && ecart !== 0
          ? [`Écart de ${ecart} entre le décompte physique et l'existant de référence`]
          : [];
      for (const message of ligneAvertissements) {
        avertissements.push(`${detail.article.designation} : ${message}`);
      }
      lignes.push({
        detailId: detail.id,
        ligneId: ligneEnregistree?.id ?? null,
        articleId: detail.articleId,
        designation: detail.article.designation,
        unite: detail.article.unite,
        nomenclatureCode: detail.article.nomenclature.code,
        nomenclatureLibelle: detail.article.nomenclature.libelle,
        chapitreCode: detail.article.paragraphe.article.chapitre.chapitre,
        articleCode: detail.article.paragraphe.article.article,
        paragrapheCode: detail.article.paragraphe.code,
        folioGrandLivre: detail.folioGrandLivre,
        prixUnitaire: detail.prixUnitaire,
        existantDebut: detail.existantDebut,
        entrees: detail.entrees,
        sorties,
        resteTheorique: theorique,
        valeurTheorique: theorique * Number(detail.prixUnitaire),
        existantReference,
        decomptePhysique,
        quantiteExcedent,
        quantiteDeficit,
        ecart,
        observationEtat:
          detail.observationEtat?.trim() || ETAT_MATIERE_DEFAUT,
        observations,
        avertissements: ligneAvertissements,
      });
    }
    lignes.sort(
      (a, b) =>
        a.nomenclatureCode.localeCompare(b.nomenclatureCode) ||
        a.designation.localeCompare(b.designation) ||
        Number(a.prixUnitaire) - Number(b.prixUnitaire),
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

  async updateObservationEtat(
    exerciceId: number,
    userId: number,
    dto: UpdateObservationEtatDto,
  ) {
    const { exercice, user } = await this.chargerExercice(exerciceId, userId);
    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new ForbiddenException(
        "Seul le dépositaire-comptable peut modifier l'état",
      );
    }
    if (exercice.statut === 'CLOTURE') {
      throw new ForbiddenException('Cet exercice est clôturé');
    }
    const detail = (exercice.compteMatiere?.details ?? []).find(
      (candidate) => candidate.id === dto.detailId,
    );
    if (!detail) {
      throw new NotFoundException(
        'Ligne de compte matière introuvable pour cet exercice',
      );
    }
    await this.prisma.detailCompteMatiere.update({
      where: { id: detail.id },
      data: { observationEtat: dto.observationEtat },
    });
    return {
      detailId: detail.id,
      observationEtat: dto.observationEtat,
    };
  }

  private verifierEcriture(
    user: { role: Role },
    exercice: { statut: string },
  ) {
    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new ForbiddenException(
        'Seul le dépositaire-comptable peut saisir le recensement',
      );
    }
    if (exercice.statut === 'CLOTURE') {
      throw new ForbiddenException('Cet exercice est clôturé');
    }
  }

  private dateInventaireParDefaut(exercice: {
    dateDebut: Date;
    dateFin: Date;
  }): Date {
    const maintenant = new Date();
    if (maintenant < exercice.dateDebut) return exercice.dateDebut;
    if (maintenant > exercice.dateFin) return exercice.dateFin;
    return maintenant;
  }

  /**
   * Enregistre une ligne de recensement et, si nécessaire, l'entrée de
   * stock correspondant à l'excédent. Aucun mouvement n'est créé pour un
   * déficit : c'est une constatation physique, pas une sortie.
   */
  async upsertLigne(
    exerciceId: number,
    userId: number,
    dto: UpsertLigneInventaireDto,
  ) {
    const { exercice, user } = await this.chargerExercice(exerciceId, userId);
    this.verifierEcriture(user, exercice);

    const article = await this.prisma.article.findUnique({
      where: { id: dto.articleId },
      select: { id: true },
    });
    if (!article) {
      throw new NotFoundException('Article introuvable');
    }

    await this.prisma.$transaction(async (tx) => {
      let compte = await tx.compteMatiere.findUnique({
        where: { exerciceId: exercice.id },
      });
      const dateInventaire =
        exercice.inventaire?.dateInventaire ??
        this.dateInventaireParDefaut(exercice);
      const inventaire = await tx.inventaire.upsert({
        where: { exerciceId: exercice.id },
        create: { exerciceId: exercice.id, dateInventaire },
        update: {},
      });

      let ligne = await tx.ligneInventaire.findUnique({
        where: {
          inventaireId_articleId_prixUnitaire: {
            inventaireId: inventaire.id,
            articleId: dto.articleId,
            prixUnitaire: dto.prixUnitaire,
          },
        },
      });

      let detail = compte
        ? await tx.detailCompteMatiere.findUnique({
            where: {
              compteMatiereId_articleId_prixUnitaire: {
                compteMatiereId: compte.id,
                articleId: dto.articleId,
                prixUnitaire: dto.prixUnitaire,
              },
            },
          })
        : null;

      if (!detail) {
        if (!compte) {
          compte = await tx.compteMatiere.create({
            data: { exerciceId: exercice.id },
          });
        }
        detail = await tx.detailCompteMatiere.create({
          data: {
            compteMatiereId: compte.id,
            articleId: dto.articleId,
            prixUnitaire: dto.prixUnitaire,
            existantDebut: 0,
            creeParRecensement: true,
          },
        });
      }
      if (!compte) {
        throw new BadRequestException('Compte matière introuvable');
      }
      if (
        dto.observationEtat &&
        detail.observationEtat !== dto.observationEtat
      ) {
        detail = await tx.detailCompteMatiere.update({
          where: { id: detail.id },
          data: { observationEtat: dto.observationEtat },
        });
      }

      const existantReference =
        ligne?.existantReference !== null &&
        ligne?.existantReference !== undefined
          ? Number(ligne.existantReference)
          : Number(detail.existantDebut) +
            Number(detail.entrees) -
            Number(detail.sorties);
      const quantiteConstatee =
        dto.quantiteConstatee !== undefined &&
        dto.quantiteConstatee !== null
          ? dto.quantiteConstatee
          : ligne
            ? Number(ligne.quantitePhysique)
            : existantReference;
      const quantiteExcedent =
        dto.quantiteExcedent !== undefined
          ? dto.quantiteExcedent
          : ligne?.quantiteExcedent !== null &&
              ligne?.quantiteExcedent !== undefined
            ? Number(ligne.quantiteExcedent)
            : null;
      const quantiteDeficit =
        dto.quantiteDeficit !== undefined
          ? dto.quantiteDeficit
          : ligne?.quantiteDeficit !== null &&
              ligne?.quantiteDeficit !== undefined
            ? Number(ligne.quantiteDeficit)
            : null;

      const ancienExcedent =
        ligne?.quantiteExcedent !== null &&
        ligne?.quantiteExcedent !== undefined
          ? Number(ligne.quantiteExcedent)
          : 0;
      const nouvelExcedent = quantiteExcedent ?? 0;

      if (ligne) {
        ligne = await tx.ligneInventaire.update({
          where: { id: ligne.id },
          data: {
            quantitePhysique: quantiteConstatee,
            quantiteExcedent,
            quantiteDeficit,
            existantReference,
          },
        });
      } else {
        ligne = await tx.ligneInventaire.create({
          data: {
            inventaireId: inventaire.id,
            articleId: dto.articleId,
            prixUnitaire: dto.prixUnitaire,
            quantitePhysique: quantiteConstatee,
            quantiteExcedent,
            quantiteDeficit,
            existantReference,
          },
        });
      }

      const delta = nouvelExcedent - ancienExcedent;
      if (delta !== 0) {
        const entrees = Number(detail.entrees) + delta;
        if (entrees < 0) {
          throw new BadRequestException(
            'Stock incohérent : les entrées ne peuvent pas devenir négatives',
          );
        }
        detail = await tx.detailCompteMatiere.update({
          where: { id: detail.id },
          data: { entrees },
        });
      }

      const mouvement = await tx.mouvement.findUnique({
        where: { ligneInventaireId: ligne.id },
      });
      if (nouvelExcedent > 0) {
        if (mouvement) {
          await tx.mouvement.update({
            where: { id: mouvement.id },
            data: {
              type: TypeMouvement.ENTREE,
              date: dateInventaire,
              quantite: nouvelExcedent,
              prixUnitaire: dto.prixUnitaire,
              origine: OrigineMouvement.RECENSEMENT,
            },
          });
        } else {
          await tx.mouvement.create({
            data: {
              type: TypeMouvement.ENTREE,
              date: dateInventaire,
              exerciceId: exercice.id,
              articleId: dto.articleId,
              quantite: nouvelExcedent,
              prixUnitaire: dto.prixUnitaire,
              origine: OrigineMouvement.RECENSEMENT,
              ligneInventaireId: ligne.id,
            },
          });
        }
      } else if (mouvement) {
        await tx.mouvement.delete({ where: { id: mouvement.id } });
      }

      await recalculerValeursCompte(tx, compte.id);
    });

    return this.obtenir(exerciceId, userId);
  }

  /**
   * Supprime une ligne de recensement et annule son entrée d'excédent.
   * L'article et le détail du compte matière restent présents.
   */
  async supprimerLigne(
    exerciceId: number,
    userId: number,
    ligneId: number,
  ) {
    const { exercice, user } = await this.chargerExercice(exerciceId, userId);
    this.verifierEcriture(user, exercice);

    await this.prisma.$transaction(async (tx) => {
      const inventaire = await tx.inventaire.findUnique({
        where: { exerciceId: exercice.id },
      });
      if (!inventaire) {
        throw new NotFoundException('Ligne de recensement introuvable');
      }
      const ligne = await tx.ligneInventaire.findFirst({
        where: { id: ligneId, inventaireId: inventaire.id },
      });
      if (!ligne) {
        throw new NotFoundException('Ligne de recensement introuvable');
      }

      const compte = await tx.compteMatiere.findUnique({
        where: { exerciceId: exercice.id },
        select: { id: true },
      });
      let detail = compte
        ? await tx.detailCompteMatiere.findUnique({
            where: {
              compteMatiereId_articleId_prixUnitaire: {
                compteMatiereId: compte.id,
                articleId: ligne.articleId,
                prixUnitaire: ligne.prixUnitaire,
              },
            },
          })
        : null;
      const mouvement = await tx.mouvement.findUnique({
        where: { ligneInventaireId: ligne.id },
      });
      if (mouvement) {
        if (detail) {
          const entrees = Number(detail.entrees) - Number(mouvement.quantite);
          if (entrees < 0) {
            throw new BadRequestException(
              'Stock incohérent : les entrées ne peuvent pas devenir négatives',
            );
          }
          detail = await tx.detailCompteMatiere.update({
            where: { id: detail.id },
            data: { entrees },
          });
        }
        await tx.mouvement.delete({ where: { id: mouvement.id } });
      }

      await tx.ligneInventaire.delete({ where: { id: ligne.id } });
      const restantes = await tx.ligneInventaire.count({
        where: { inventaireId: inventaire.id },
      });
      if (restantes === 0) {
        await tx.inventaire.delete({ where: { id: inventaire.id } });
      }

      if (
        detail?.creeParRecensement &&
        Number(detail.existantDebut) === 0 &&
        Number(detail.entrees) === 0 &&
        Number(detail.sorties) === 0 &&
        (detail.folioGrandLivre === null ||
          detail.folioGrandLivre === undefined) &&
        !(detail.observation ?? '').trim() &&
        detail.observationEtat === ETAT_MATIERE_DEFAUT
      ) {
        const autresMouvements = await tx.mouvement.count({
          where: {
            exerciceId: exercice.id,
            articleId: ligne.articleId,
            prixUnitaire: ligne.prixUnitaire,
          },
        });
        if (autresMouvements === 0) {
          await tx.detailCompteMatiere.delete({ where: { id: detail.id } });
        }
      }

      if (compte) {
        await recalculerValeursCompte(tx, compte.id);
      }
    });

    return this.obtenir(exerciceId, userId);
  }

  async enregistrer(exerciceId: number, userId: number, dto: SaveInventaireDto) {
    const { exercice } = await this.chargerExercice(exerciceId, userId);
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
      const compte = await tx.compteMatiere.findUnique({
        where: { exerciceId },
        select: { id: true },
      });
      const inventaire = await tx.inventaire.upsert({
        where: { exerciceId },
        create: { exerciceId, dateInventaire: date },
        update: { dateInventaire: date },
      });
      const anciennes = await tx.ligneInventaire.findMany({
        where: { inventaireId: inventaire.id },
        include: { mouvement: true },
      });
      for (const ancienne of anciennes) {
        if (!ancienne.mouvement || !compte) continue;
        const detail = await tx.detailCompteMatiere.findUnique({
          where: {
            compteMatiereId_articleId_prixUnitaire: {
              compteMatiereId: compte.id,
              articleId: ancienne.articleId,
              prixUnitaire: ancienne.prixUnitaire,
            },
          },
        });
        if (!detail) continue;
        const entrees =
          Number(detail.entrees) - Number(ancienne.mouvement.quantite);
        if (entrees < 0) {
          throw new BadRequestException(
            'Stock incohérent : les entrées ne peuvent pas devenir négatives',
          );
        }
        await tx.detailCompteMatiere.update({
          where: { id: detail.id },
          data: { entrees },
        });
      }
      await tx.ligneInventaire.deleteMany({
        where: { inventaireId: inventaire.id },
      });
      for (const ligne of dto.lignes) {
        const detail = compte
          ? await tx.detailCompteMatiere.findUnique({
              where: {
                compteMatiereId_articleId_prixUnitaire: {
                  compteMatiereId: compte.id,
                  articleId: ligne.articleId,
                  prixUnitaire: ligne.prixUnitaire,
                },
              },
            })
          : null;
        const existantReference = detail
          ? Number(detail.existantDebut) +
            Number(detail.entrees) -
            Number(detail.sorties)
          : 0;
        const ecart = Number(ligne.quantitePhysique) - existantReference;
        await tx.ligneInventaire.create({
          data: {
            inventaireId: inventaire.id,
            articleId: ligne.articleId,
            prixUnitaire: ligne.prixUnitaire,
            quantitePhysique: ligne.quantitePhysique,
            existantReference,
            quantiteExcedent: ecart > 0 ? ecart : null,
            quantiteDeficit: ecart < 0 ? -ecart : null,
          },
        });
      }
      if (compte) {
        await recalculerValeursCompte(tx, compte.id);
      }
    });

    return this.obtenir(exerciceId, userId);
  }
}
