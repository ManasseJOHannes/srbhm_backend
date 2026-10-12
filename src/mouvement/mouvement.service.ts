import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMouvementDto } from './dto/create-mouvement.dto.js';
import { ecritureObservationLot } from '../observations-stock/observation-stock.helper.js';

@Injectable()
export class MouvementService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}


  // Mouvement de l'année courante
  async create(
    dto: CreateMouvementDto,
    userId: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        soaId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new BadRequestException(
        'Seul un dépositaire-comptable peut enregistrer un mouvement',
      );
    }

    const dateMouvement = new Date(dto.date);

    if (Number.isNaN(dateMouvement.getTime())) {
      throw new BadRequestException('Date du mouvement invalide');
    }

    const currentYear = new Date().getFullYear();

    if (dateMouvement.getFullYear() !== currentYear) {
      throw new BadRequestException(
        `Le mouvement doit appartenir à l'année courante ${currentYear}`,
      );
    }

    const exercice = await this.prisma.exercice.findUnique({
      where: {
        soaId_annee: {
          soaId: user.soaId,
          annee: currentYear,
        },
      },
    });

    if (!exercice) {
      throw new NotFoundException(
        `L'exercice ${currentYear} est introuvable pour ce SOA`,
      );
    }

    if (exercice.statut !== 'EN_COURS') {
      throw new BadRequestException(
        'Cet exercice est clôturé',
      );
    }

    const article = await this.prisma.article.findUnique({
      where: { id: dto.articleId },
    });

    if (!article) {
      throw new NotFoundException('Article introuvable');
    }

    const quantite = new Prisma.Decimal(String(dto.quantite));

    if (!quantite.greaterThan(0)) {
      throw new BadRequestException('La quantité doit être supérieure à zéro');
    }

    return this.prisma.$transaction(async (tx) => {
      let prixUnitaire: Prisma.Decimal;

      if (dto.type === 'ENTREE') {
        prixUnitaire = new Prisma.Decimal(
          String(dto.prixUnitaire),
        );

        const mouvement = await tx.mouvement.create({
          data: {
            type: 'ENTREE',
            date: dateMouvement,
            exerciceId: exercice.id,
            articleId: article.id,
            quantite,
            prixUnitaire,
            observation: dto.observation,
          },
          include: {
            article: { include: { nomenclature: true } },
            exercice: { include: { soa: true } },
          },
        });

        await tx.lotStock.create({
          data: {
            articleId: article.id,
            exerciceId: exercice.id,
            typeOrigine: 'ENTREE',
            mouvementEntreeId: mouvement.id,
            dateOrigine: dateMouvement,
            quantiteInitiale: quantite,
            quantiteRestante: quantite,
            prixUnitaire,
            ...ecritureObservationLot(dto.observation),
          },
        });

        return mouvement;
      }

      if (!dto.lotStockId) {
        throw new BadRequestException(
          'Vous devez sélectionner un lot de stock pour la sortie',
        );
      }

      const lot = await tx.lotStock.findFirst({
        where: {
          id: dto.lotStockId,
          articleId: article.id,
          exerciceId: exercice.id,
          dateOrigine: { lte: dateMouvement },
          quantiteRestante: { gt: 0 },
        },
      });

      if (!lot) {
        throw new NotFoundException(
          'Lot de stock introuvable pour cet article et cet exercice',
        );
      }

      if (quantite.greaterThan(lot.quantiteRestante)) {
        throw new BadRequestException(
          `Stock insuffisant pour ce lot. Disponible : ${lot.quantiteRestante.toString()}`,
        );
      }

      prixUnitaire = lot.prixUnitaire;

      if (
        dto.prixUnitaire !== undefined &&
        !new Prisma.Decimal(String(dto.prixUnitaire)).equals(prixUnitaire)
      ) {
        throw new BadRequestException(
          'Le prix unitaire ne correspond pas au lot sélectionné',
        );
      }

      const mouvement = await tx.mouvement.create({
        data: {
          type: 'SORTIE',
          date: dateMouvement,
          exerciceId: exercice.id,
          articleId: article.id,
          quantite,
          prixUnitaire,
          observation: dto.observation,
        },
        include: {
          article: { include: { nomenclature: true } },
          exercice: { include: { soa: true } },
        },
      });

      const miseAJourLot = await tx.lotStock.updateMany({
        where: {
          id: lot.id,
          articleId: article.id,
          exerciceId: exercice.id,
          prixUnitaire,
          dateOrigine: { lte: dateMouvement },
          quantiteRestante: { gte: quantite },
        },
        data: {
          quantiteRestante: {
            decrement: quantite,
          },
        },
      });

      if (miseAJourLot.count !== 1) {
        throw new ConflictException(
          'Le stock du lot a changé pendant l’enregistrement. Réessayez la sortie.',
        );
      }

      await tx.affectationSortie.create({
        data: {
          mouvementSortieId: mouvement.id,
          lotStockId: lot.id,
          quantite,
        },
      });

      return mouvement;
    });
  }


  // Mouvement historique lié à un Compte Matière
  async createHistorique(
    compteMatiereId: number,
    dto: CreateMouvementDto,
    userId: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        soaId: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Utilisateur introuvable',
      );
    }

    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new BadRequestException(
        'Seul un dépositaire-comptable peut enregistrer un mouvement historique',
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
      compteMatiere.exercice.soaId !== user.soaId
    ) {
      throw new NotFoundException(
        'Compte Matière introuvable',
      );
    }

    const currentYear = new Date().getFullYear();

    if (
      compteMatiere.exercice.annee >= currentYear
    ) {
      throw new BadRequestException(
        'Le mouvement historique concerne uniquement une ancienne année',
      );
    }

    const dateMouvement = new Date(dto.date);

    if (Number.isNaN(dateMouvement.getTime())) {
      throw new BadRequestException(
        'Date du mouvement invalide',
      );
    }

    if (
      dateMouvement < compteMatiere.exercice.dateDebut ||
      dateMouvement > compteMatiere.exercice.dateFin
    ) {
      throw new BadRequestException(
        `La date doit être comprise entre ${compteMatiere.exercice.annee}-01-01 et ${compteMatiere.exercice.annee}-12-31`,
      );
    }

    const article = await this.prisma.article.findUnique({
      where: {
        id: dto.articleId,
      },
    });

    if (!article) {
      throw new NotFoundException(
        'Article introuvable',
      );
    }

    const prixUnitaire = new Prisma.Decimal(
      String(dto.prixUnitaire),
    );

    const quantite = new Prisma.Decimal(
      String(dto.quantite),
    );

    if (!quantite.greaterThan(0)) {
      throw new BadRequestException('La quantité doit être supérieure à zéro');
    }

    return this.prisma.$transaction(async (tx) => {
      const detailsArticle =
        await tx.detailCompteMatiere.findMany({
          where: {
              compteMatiereId,
              articleId: dto.articleId,
          },
        });
      let detail = detailsArticle.find((item) =>
          item.prixUnitaire.equals(prixUnitaire),
        );

      // Un exercice peut déjà contenir les lots STOCK_INITIAL reportés
      // sans avoir encore de ligne correspondante dans son Compte Matière.
      // Dans ce seul cas, reconstituer la ligne comptable depuis les lots
      // reportés, sans créer un second lot d'ouverture.
      if (dto.type === 'SORTIE') {
        const lotsReportes = await tx.lotStock.findMany({
          where: {
            articleId: article.id,
            exerciceId: compteMatiere.exerciceId,
            prixUnitaire,
            typeOrigine: 'STOCK_INITIAL',
            dateOrigine: { lte: dateMouvement },
            quantiteInitiale: { gt: 0 },
          },
          select: { quantiteInitiale: true },
        });

        const stockInitialReporte = lotsReportes.reduce(
          (total, lot) => total.plus(lot.quantiteInitiale),
          new Prisma.Decimal(0),
        );

        const detailEstVide =
          detail &&
          new Prisma.Decimal(detail.existantDebut).isZero() &&
          new Prisma.Decimal(detail.entrees).isZero() &&
          new Prisma.Decimal(detail.sorties).isZero();

        if (stockInitialReporte.greaterThan(0) && (!detail || detailEstVide)) {
          const mouvementsExistants = await tx.mouvement.findMany({
            where: {
              exerciceId: compteMatiere.exerciceId,
              articleId: article.id,
              prixUnitaire,
            },
            select: { type: true, quantite: true },
          });

          const entreesExistantes = mouvementsExistants.reduce(
            (total, mouvement) =>
              mouvement.type === 'ENTREE'
                ? total.plus(mouvement.quantite)
                : total,
            new Prisma.Decimal(0),
          );
          const sortiesExistantes = mouvementsExistants.reduce(
            (total, mouvement) =>
              mouvement.type === 'SORTIE'
                ? total.plus(mouvement.quantite)
                : total,
            new Prisma.Decimal(0),
          );

          if (detail) {
            detail = await tx.detailCompteMatiere.update({
              where: { id: detail.id },
              data: {
                existantDebut: stockInitialReporte,
                entrees: entreesExistantes,
                sorties: sortiesExistantes,
              },
            });
          } else {
            detail = await tx.detailCompteMatiere.create({
              data: {
                compteMatiereId,
                articleId: article.id,
                prixUnitaire,
                existantDebut: stockInitialReporte,
                entrees: entreesExistantes,
                sorties: sortiesExistantes,
                observation: 'Stock initial reporté depuis un exercice antérieur',
              },
            });
          }
        }
      }

      if (!detail) {
        throw new NotFoundException(
          'Aucun détail correspondant à cet article et à ce prix dans le Compte Matière',
        );
      }

      const affectationsFifo: Array<{
        lotStockId: number;
        quantite: Prisma.Decimal;
      }> = [];

      if (dto.type === 'SORTIE') {
        const lotsDisponibles = await tx.lotStock.findMany({
          where: {
            articleId: article.id,
            exerciceId: compteMatiere.exerciceId,
            prixUnitaire,
            dateOrigine: { lte: dateMouvement },
            quantiteRestante: { gt: 0 },
          },
          orderBy: [{ dateOrigine: 'asc' }, { id: 'asc' }],
        });

        let quantiteARapprovisionner = new Prisma.Decimal(quantite);

        for (const lot of lotsDisponibles) {
          if (quantiteARapprovisionner.isZero()) break;

          const quantiteAffectee = Prisma.Decimal.min(
            quantiteARapprovisionner,
            lot.quantiteRestante,
          );

          affectationsFifo.push({
            lotStockId: lot.id,
            quantite: quantiteAffectee,
          });
          quantiteARapprovisionner = quantiteARapprovisionner.minus(
            quantiteAffectee,
          );
        }

        if (quantiteARapprovisionner.greaterThan(0)) {
          const stockDisponible = quantite.minus(quantiteARapprovisionner);
          throw new BadRequestException(
            `Stock insuffisant dans les lots disponibles Ã  cette date. Stock disponible : ${stockDisponible.toString()}`,
          );
        }
      }

      const mouvement =
        await tx.mouvement.create({
          data: {
            type: dto.type,
            date: dateMouvement,
            exerciceId: compteMatiere.exerciceId,
            articleId: dto.articleId,
            quantite,
            prixUnitaire,
            observation: dto.observation,
          },
        });

      if (dto.type === 'ENTREE') {
        await tx.detailCompteMatiere.update({
          where: {
            id: detail.id,
          },
          data: {
            entrees: {
              increment: quantite,
            },
          },
        });

        await tx.lotStock.create({
          data: {
            articleId: article.id,
            exerciceId: compteMatiere.exerciceId,
            typeOrigine: 'ENTREE',
            mouvementEntreeId: mouvement.id,
            dateOrigine: dateMouvement,
            quantiteInitiale: quantite,
            quantiteRestante: quantite,
            prixUnitaire,
            ...ecritureObservationLot(dto.observation),
          },
        });
      } else {
        await tx.detailCompteMatiere.update({
          where: {
            id: detail.id,
          },
          data: {
            sorties: {
              increment: quantite,
            },
          },
        });

        for (const affectation of affectationsFifo) {
          const resultatMiseAJour = await tx.lotStock.updateMany({
            where: {
              id: affectation.lotStockId,
              articleId: article.id,
              exerciceId: compteMatiere.exerciceId,
              prixUnitaire,
              dateOrigine: { lte: dateMouvement },
              quantiteRestante: { gte: affectation.quantite },
            },
            data: {
              quantiteRestante: { decrement: affectation.quantite },
            },
          });

          if (resultatMiseAJour.count !== 1) {
            throw new BadRequestException(
              'Le stock du lot a changÃ© pendant l’enregistrement. RÃ©essayez la sortie.',
            );
          }

          await tx.affectationSortie.create({
            data: {
              mouvementSortieId: mouvement.id,
              lotStockId: affectation.lotStockId,
              quantite: affectation.quantite,
            },
          });
        }
      }

      const details =
        await tx.detailCompteMatiere.findMany({
          where: {
            compteMatiereId,
          },
          select: {
            prixUnitaire: true,
            existantDebut: true,
            entrees: true,
            sorties: true,
          },
        });

      let valeurExistanteDebut =
        new Prisma.Decimal(0);

      let valeurEntrees =
        new Prisma.Decimal(0);

      let valeurSorties =
        new Prisma.Decimal(0);

      for (const item of details) {
        valeurExistanteDebut =
          valeurExistanteDebut.plus(
            item.existantDebut.times(
              item.prixUnitaire,
            ),
          );

        valeurEntrees =
          valeurEntrees.plus(
            item.entrees.times(
              item.prixUnitaire,
            ),
          );

        valeurSorties =
          valeurSorties.plus(
            item.sorties.times(
              item.prixUnitaire,
            ),
          );
      }

      const valeurRestante =
        valeurExistanteDebut
          .plus(valeurEntrees)
          .minus(valeurSorties);

      const compteMisAJour =
        await tx.compteMatiere.update({
          where: {
            id: compteMatiereId,
          },
          data: {
            valeurExistanteDebut,
            valeurEntrees,
            valeurSorties,
            valeurRestante,
          },
        });

      return {
        mouvement,
        detailCompteMatiereId: detail.id,
        compteMatiere: compteMisAJour,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async recalculerValeursCompteMatiere(
    tx: Prisma.TransactionClient,
    compteMatiereId: number,
  ) {
    const details = await tx.detailCompteMatiere.findMany({
      where: { compteMatiereId },
      select: {
        prixUnitaire: true,
        existantDebut: true,
        entrees: true,
        sorties: true,
      },
    });

    let valeurExistanteDebut = new Prisma.Decimal(0);
    let valeurEntrees = new Prisma.Decimal(0);
    let valeurSorties = new Prisma.Decimal(0);

    for (const detail of details) {
      valeurExistanteDebut = valeurExistanteDebut.plus(
        detail.existantDebut.times(detail.prixUnitaire),
      );

      valeurEntrees = valeurEntrees.plus(
        detail.entrees.times(detail.prixUnitaire),
      );

      valeurSorties = valeurSorties.plus(
        detail.sorties.times(detail.prixUnitaire),
      );
    }

    const valeurRestante = valeurExistanteDebut
      .plus(valeurEntrees)
      .minus(valeurSorties);

    return tx.compteMatiere.update({
      where: { id: compteMatiereId },
      data: {
        valeurExistanteDebut,
        valeurEntrees,
        valeurSorties,
        valeurRestante,
      },
    });
  }
  async findLotsDisponiblesSortie(exerciceId: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, soaId: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const exercice = await this.prisma.exercice.findUnique({
      where: { id: exerciceId },
      select: { id: true, soaId: true },
    });

    if (!exercice) {
      throw new NotFoundException('Exercice introuvable');
    }

    if (
      user.role === Role.DEPOSITEUR_COMPTABLE &&
      exercice.soaId !== user.soaId
    ) {
      throw new NotFoundException('Exercice introuvable');
    }

    const lots = await this.prisma.lotStock.findMany({
      where: {
        exerciceId,
      },
      include: {
        article: {
          include: { nomenclature: true },
        },
      },
      orderBy: [{ dateOrigine: 'asc' }, { id: 'asc' }],
    });

    // Un ancien stock initial peut exister à la fois comme lot racine
    // lié au détail et comme lot enfant reporté. Ces deux lignes décrivent
    // la même ouverture : exposer uniquement les lots enfants évite de
    // gonfler la quantité disponible affichée au formulaire.
    const clesAvecLotEnfant = new Set(
      lots
        .filter((lot) => lot.typeOrigine === 'STOCK_INITIAL' && lot.lotParentId !== null)
        .map((lot) => `${lot.articleId}:${new Prisma.Decimal(lot.prixUnitaire).toFixed(2)}`),
    );

    return lots.filter(
      (lot) =>
        new Prisma.Decimal(lot.quantiteRestante).greaterThan(0) &&
        !(
          lot.typeOrigine === 'STOCK_INITIAL' &&
          lot.lotParentId === null &&
          lot.detailCompteMatiereId !== null &&
          clesAvecLotEnfant.has(
            `${lot.articleId}:${new Prisma.Decimal(lot.prixUnitaire).toFixed(2)}`,
          )
        ),
    );
  }

  /**
   * Matérialise explicitement le report du stock restant vers l'exercice
   * suivant du même SOA. Aucun mouvement d'entrée n'est créé.
   */
  async reporterStockDepuisExercicePrecedent(
    exerciceCibleId: number,
    userId: number,
    transaction: Prisma.TransactionClient,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new BadRequestException(
        'Seul un dépositaire-comptable peut matérialiser un report de stock',
      );
    }

    const cible = await transaction.exercice.findUnique({
      where: { id: exerciceCibleId },
      select: { id: true, soaId: true, annee: true },
    });
    if (!cible || cible.soaId !== user.soaId) {
      throw new NotFoundException('Exercice cible introuvable');
    }

    const exercicesAnterieurs = await transaction.exercice.findMany({
      where: {
        soaId: cible.soaId,
        annee: { lt: cible.annee },
      },
      orderBy: [{ annee: 'asc' }, { id: 'asc' }],
      include: {
        compteMatiere: { select: { id: true } },
        _count: { select: { mouvements: true, lotsStock: true } },
      },
    });
    // Repartir de la première ouverture comptable, puis matérialiser les
    // exercices existants un à un. Ainsi chaque solde de clôture devient
    // l'ouverture du prochain exercice, même en l'absence de Compte Matière.
    const indexPremierCompte = exercicesAnterieurs.findIndex(
      (exercice) => exercice.compteMatiere !== null,
    );

    if (indexPremierCompte < 0) {
      return { reporte: false, raison: 'AUCUN_EXERCICE_PRECEDENT' as const };
    }

    const chronologie = [
      ...exercicesAnterieurs.slice(indexPremierCompte),
      cible,
    ];
    const reports = [];
    for (let index = 0; index < chronologie.length - 1; index += 1) {
      reports.push(
        await this.reporterStockVersExerciceSuivant(
          chronologie[index].id,
          userId,
          chronologie[index + 1].id,
          transaction,
        ),
      );
    }

    return { reporte: true, ...reports[reports.length - 1], reports };
  }

  async reporterStockVersExerciceSuivant(
    exerciceSourceId: number,
    userId: number,
    exerciceCibleId?: number,
    transaction?: Prisma.TransactionClient,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, soaId: true },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new BadRequestException(
        'Seul un dépositaire-comptable peut matérialiser un report de stock',
      );
    }

    const effectuerReport = async (tx: Prisma.TransactionClient) => {
        const sourceResume = await tx.exercice.findUnique({
          where: { id: exerciceSourceId },
          select: { id: true, soaId: true },
        });
        if (!sourceResume || sourceResume.soaId !== user.soaId) {
          throw new NotFoundException('Exercice source introuvable');
        }

        const ouvertureSource = await tx.exercice.findUnique({
          where: { id: exerciceSourceId },
          include: {
            lotsStock: true,
            compteMatiere: { include: { details: true } },
          },
        });
        if (!ouvertureSource || ouvertureSource.soaId !== user.soaId) {
          throw new NotFoundException('Exercice source introuvable');
        }

        // Une ancienne ouverture comptable sans lot doit être matérialisée
        // avant le calcul FIFO. On ne crée aucun mouvement et on refuse un
        // stock initial déjà présent mais divergent au lieu de le remplacer.
        for (const detail of ouvertureSource.compteMatiere?.details ?? []) {
          const quantiteOuverture = new Prisma.Decimal(detail.existantDebut);
          if (!quantiteOuverture.greaterThan(0)) continue;
          const lotsOuverture = ouvertureSource.lotsStock.filter(
            (lot) =>
              lot.typeOrigine === 'STOCK_INITIAL' &&
              lot.articleId === detail.articleId &&
              new Prisma.Decimal(lot.prixUnitaire).equals(detail.prixUnitaire),
          );
          if (lotsOuverture.length === 0) {
            await tx.lotStock.create({
              data: {
                articleId: detail.articleId,
                exerciceId: ouvertureSource.id,
                typeOrigine: 'STOCK_INITIAL',
                detailCompteMatiereId: detail.id,
                dateOrigine: ouvertureSource.dateDebut,
                quantiteInitiale: quantiteOuverture,
                quantiteRestante: quantiteOuverture,
                prixUnitaire: detail.prixUnitaire,
                ...ecritureObservationLot(detail.observation),
              },
            });
            continue;
          }

          const lotsCanoniques = lotsOuverture.some(
            (lot) => lot.lotParentId !== null,
          )
            ? lotsOuverture.filter((lot) => lot.lotParentId !== null)
            : lotsOuverture;
          const totalOuvertureLots = lotsCanoniques.reduce(
            (total, lot) => total.plus(lot.quantiteInitiale),
            new Prisma.Decimal(0),
          );
          if (!totalOuvertureLots.equals(quantiteOuverture)) {
            throw new ConflictException(
              `Le stock initial comptable et les lots divergent pour ${detail.articleId}:${detail.prixUnitaire.toString()}; report annulé`,
            );
          }
        }

        // Rejouer les mouvements enregistrés sur la source avant de lire ses
        // soldes, afin qu'une sortie historique sans affectation ancienne ne
        // soit pas reportée comme si le lot était encore entier.
        await this.recalculerLotsEtSortiesExercice(tx, sourceResume.id);

        const source = await tx.exercice.findUnique({
          where: { id: exerciceSourceId },
          include: {
            lotsStock: true,
            compteMatiere: { include: { details: true } },
          },
        });

        if (!source || source.soaId !== user.soaId) {
          throw new NotFoundException('Exercice source introuvable');
        }

        const cible = exerciceCibleId
          ? await tx.exercice.findUnique({
              where: { id: exerciceCibleId },
              include: {
                lotsStock: true,
                compteMatiere: { include: { details: true } },
              },
            })
          : await tx.exercice.findFirst({
              where: {
                soaId: source.soaId,
                annee: { gt: source.annee },
              },
              orderBy: [{ annee: 'asc' }, { id: 'asc' }],
              include: {
                lotsStock: true,
                compteMatiere: { include: { details: true } },
              },
            });

        if (!cible) {
          throw new NotFoundException(
            'Aucun exercice suivant n’existe pour ce SOA',
          );
        }
        if (cible.soaId !== source.soaId || cible.annee <= source.annee) {
          throw new BadRequestException(
            'Le report doit viser un exercice ultérieur du même SOA',
          );
        }
        // Un exercice intermédiaire peut porter des sorties/entrées sans
        // compte exploitable. Les STOCK_INITIAL enfants sont des copies de
        // traçabilité et ne sont jamais additionnés à nouveau : on traverse
        // uniquement les lots source et les lots issus d'entrées réelles,
        // puis on rejoue chronologiquement les sorties intermédiaires.
        const exercicesIntermediaires = await tx.exercice.findMany({
          where: {
            soaId: source.soaId,
            annee: { gt: source.annee, lt: cible.annee },
          },
          select: { id: true, annee: true },
          orderBy: [{ annee: 'asc' }, { id: 'asc' }],
        });
        const idsIntermediaires = exercicesIntermediaires.map((item) => item.id);
        // Matérialiser aussi le solde final de chaque exercice intermédiaire.
        // Ce recalcul reconstitue les affectations FIFO manquantes et met à
        // jour quantiteRestante dans la même transaction que le report cible.
        for (const exercice of exercicesIntermediaires) {
          await this.recalculerLotsEtSortiesExercice(tx, exercice.id);
        }
        const mouvementsIntermediaires = idsIntermediaires.length
          ? await tx.mouvement.findMany({
              where: { exerciceId: { in: idsIntermediaires } },
              orderBy: [{ date: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                type: true,
                date: true,
                exerciceId: true,
                articleId: true,
                prixUnitaire: true,
                quantite: true,
                observation: true,
              },
            })
          : [];
        const lotsIntermediaires: typeof source.lotsStock = idsIntermediaires.length
          ? await tx.lotStock.findMany({
              where: { exerciceId: { in: idsIntermediaires } },
            })
          : [];

        // Une entrée réelle sans lot matérialisé reste une source valide.
        // Créer son lot lié au mouvement (sans mouvement supplémentaire)
        // permet de préserver la traçabilité du report.
        for (const mouvement of mouvementsIntermediaires.filter(
          (item) => item.type === 'ENTREE',
        )) {
          const lotEntree = lotsIntermediaires.find(
            (lot) => lot.mouvementEntreeId === mouvement.id,
          );
          if (lotEntree) {
            if (
              lotEntree.articleId !== mouvement.articleId ||
              lotEntree.exerciceId !== mouvement.exerciceId ||
              !new Prisma.Decimal(lotEntree.prixUnitaire).equals(mouvement.prixUnitaire) ||
              !new Prisma.Decimal(lotEntree.quantiteInitiale).equals(mouvement.quantite) ||
              lotEntree.dateOrigine.getTime() !== mouvement.date.getTime()
            ) {
              throw new ConflictException(
                `Le lot d'entrée du mouvement ${mouvement.id} est incohérent; report annulé`,
              );
            }
            continue;
          }
          const lot = await tx.lotStock.create({
            data: {
              articleId: mouvement.articleId,
              exerciceId: mouvement.exerciceId,
              typeOrigine: 'ENTREE',
              mouvementEntreeId: mouvement.id,
              dateOrigine: mouvement.date,
              quantiteInitiale: mouvement.quantite,
              quantiteRestante: mouvement.quantite,
              prixUnitaire: mouvement.prixUnitaire,
              ...ecritureObservationLot(mouvement.observation),
            },
          });
          lotsIntermediaires.push(lot);
        }

        const cleStock = (articleId: number, prix: Prisma.Decimal) =>
          `${articleId}:${prix.toFixed(2)}`;
        const lotsEntrants = new Map<
          string,
          { quantite: Prisma.Decimal; articleId: number; prix: Prisma.Decimal }
        >();

        for (const lot of source.lotsStock) {
          const initiale = new Prisma.Decimal(lot.quantiteInitiale);
          const restante = new Prisma.Decimal(lot.quantiteRestante);
          if (initiale.lessThan(0) || restante.lessThan(0) || restante.greaterThan(initiale)) {
            throw new ConflictException(
              `Lot source ${lot.id} incohérent; report annulé`,
            );
          }
        }

        for (const enfant of cible.lotsStock.filter(
          (lot) => lot.typeOrigine === 'STOCK_INITIAL' && lot.lotParentId !== null,
        )) {
          const parent = source.lotsStock.find(
            (lot) => lot.id === enfant.lotParentId,
          );
          if (!parent) continue;
          const doublons = cible.lotsStock.filter(
            (lot) =>
              lot.typeOrigine === 'STOCK_INITIAL' &&
              lot.lotParentId === parent.id,
          );
          if (
            doublons.length !== 1 ||
            enfant.articleId !== parent.articleId ||
            !new Prisma.Decimal(enfant.prixUnitaire).equals(parent.prixUnitaire) ||
            !new Prisma.Decimal(enfant.quantiteInitiale).equals(parent.quantiteRestante)
          ) {
            throw new ConflictException(
              `Le report déjà présent pour le lot source ${parent.id} est incohérent`,
            );
          }
        }

        // Les lots STOCK_INITIAL enfants matérialisent déjà l'ouverture.
        // Si l'ancien détail possède aussi son lot racine, ne pas compter
        // ce même stock une seconde fois.
        const ouvertureEnfants = new Map<string, Prisma.Decimal>();
        for (const lot of source.lotsStock) {
          if (lot.typeOrigine !== 'STOCK_INITIAL' || lot.lotParentId === null) {
            continue;
          }
          const cle = cleStock(lot.articleId, lot.prixUnitaire);
          ouvertureEnfants.set(
            cle,
            (ouvertureEnfants.get(cle) ?? new Prisma.Decimal(0)).plus(
              lot.quantiteInitiale,
            ),
          );
        }

        for (const [cle, quantiteEnfant] of ouvertureEnfants) {
          const detail = source.compteMatiere?.details.find(
            (ligne) => cleStock(ligne.articleId, ligne.prixUnitaire) === cle,
          );
          if (
            detail &&
            !new Prisma.Decimal(detail.existantDebut).isZero() &&
            !new Prisma.Decimal(detail.existantDebut).equals(quantiteEnfant)
          ) {
            throw new ConflictException(
              `Ouverture comptable différente des lots reportés pour ${cle}; report annulé`,
            );
          }
          const racinesSansDetail = source.lotsStock.filter(
            (lot) =>
              lot.typeOrigine === 'STOCK_INITIAL' &&
              lot.lotParentId === null &&
              lot.detailCompteMatiereId === null &&
              cleStock(lot.articleId, lot.prixUnitaire) === cle,
          );
          if (racinesSansDetail.length > 0) {
            throw new ConflictException(
              `Un lot STOCK_INITIAL racine sans détail coexiste avec un report enfant pour ${cle}; vérification manuelle requise`,
            );
          }
        }

        const lotsOuvertureEnfantsSource = new Map<string, Prisma.Decimal>();
        for (const lot of source.lotsStock) {
          if (lot.typeOrigine !== 'STOCK_INITIAL' || lot.lotParentId === null) continue;
          const cle = cleStock(lot.articleId, lot.prixUnitaire);
          lotsOuvertureEnfantsSource.set(
            cle,
            (lotsOuvertureEnfantsSource.get(cle) ?? new Prisma.Decimal(0)).plus(
              lot.quantiteInitiale,
            ),
          );
        }

        const lotsOrigine = source.lotsStock.filter((lot) =>
          !(
            lot.typeOrigine === 'STOCK_INITIAL' &&
            lot.lotParentId === null &&
            lot.detailCompteMatiereId !== null &&
            lotsOuvertureEnfantsSource.has(cleStock(lot.articleId, lot.prixUnitaire))
          ),
        );
        const clesSourceConnues = new Set(
          lotsOrigine.map((lot) => cleStock(lot.articleId, lot.prixUnitaire)),
        );
        const lotsFluxIntermediaires = lotsIntermediaires.filter((lot) => {
          if (lot.typeOrigine === 'ENTREE') return true;
          if (lot.typeOrigine !== 'STOCK_INITIAL' || lot.lotParentId !== null) {
            return false;
          }
          const cle = cleStock(lot.articleId, lot.prixUnitaire);
          if (clesSourceConnues.has(cle)) {
            throw new ConflictException(
              `Un lot STOCK_INITIAL intermédiaire sans parent coexiste avec un stock source pour ${cle}; vérification manuelle requise`,
            );
          }
          return true;
        });
        const lotsTransmissibles = [...lotsOrigine, ...lotsFluxIntermediaires];
        const soldesChronologiques = new Map<number, Prisma.Decimal>();
        for (const lot of lotsOrigine) {
          soldesChronologiques.set(lot.id, new Prisma.Decimal(lot.quantiteRestante));
        }
        for (const lot of lotsFluxIntermediaires) {
          soldesChronologiques.set(lot.id, new Prisma.Decimal(lot.quantiteInitiale));
        }

        for (const mouvement of mouvementsIntermediaires) {
          if (mouvement.type !== 'SORTIE') continue;
          let reste = new Prisma.Decimal(mouvement.quantite);
          if (!reste.greaterThan(0)) {
            throw new ConflictException(
              `La quantité de sortie ${mouvement.id} doit être positive; report annulé`,
            );
          }
          const candidats = lotsTransmissibles
            .filter((lot) =>
              lot.articleId === mouvement.articleId &&
              new Prisma.Decimal(lot.prixUnitaire).equals(mouvement.prixUnitaire) &&
              lot.dateOrigine <= mouvement.date,
            )
            .sort((a, b) =>
              a.dateOrigine.getTime() - b.dateOrigine.getTime() || a.id - b.id,
            );

          for (const lot of candidats) {
            if (reste.isZero()) break;
            const disponible = soldesChronologiques.get(lot.id) ?? new Prisma.Decimal(0);
            const affectee = Prisma.Decimal.min(reste, disponible);
            soldesChronologiques.set(lot.id, disponible.minus(affectee));
            reste = reste.minus(affectee);
          }
          if (reste.greaterThan(0)) {
            throw new ConflictException(
              `Stock insuffisant dans la chronologie intermédiaire pour la sortie ${mouvement.id}; report annulé`,
            );
          }
        }

        const lotsARapporter = lotsTransmissibles
          .map((lot) => ({
            lot,
            quantite: soldesChronologiques.get(lot.id) ?? new Prisma.Decimal(0),
          }))
          .filter((item) => item.quantite.greaterThan(0));

        for (const { lot, quantite } of lotsARapporter) {
          const cle = cleStock(lot.articleId, lot.prixUnitaire);
          const groupe = lotsEntrants.get(cle) ?? {
            quantite: new Prisma.Decimal(0),
            articleId: lot.articleId,
            prix: new Prisma.Decimal(lot.prixUnitaire),
          };
          groupe.quantite = groupe.quantite.plus(quantite);
          lotsEntrants.set(cle, groupe);
        }

        const nouveauxLots: Array<{
          articleId: number;
          prixUnitaire: Prisma.Decimal;
          lotParentId: number;
          quantiteInitiale: Prisma.Decimal;
          quantiteRestante: Prisma.Decimal;
        }> = [];
        const detailsAReporter: Array<{
          articleId: number;
          prixUnitaire: Prisma.Decimal;
          quantite: Prisma.Decimal;
        }> = [];

        for (const [cle, groupe] of lotsEntrants) {
          const sourceLots = lotsARapporter.filter(
            (item) => cleStock(item.lot.articleId, item.lot.prixUnitaire) === cle,
          );
          const detailCible = cible.compteMatiere?.details.find(
            (ligne) => cleStock(ligne.articleId, ligne.prixUnitaire) === cle,
          );
          const dejaReporte = cible.lotsStock.filter(
            (lot) =>
              lot.typeOrigine === 'STOCK_INITIAL' &&
              lot.lotParentId !== null &&
              sourceLots.some((sourceLot) => sourceLot.lot.id === lot.lotParentId),
          );
          const reportsSansParentAttendu = cible.lotsStock.filter(
            (lot) =>
              lot.articleId === groupe.articleId &&
              new Prisma.Decimal(lot.prixUnitaire).equals(groupe.prix) &&
              lot.typeOrigine === 'STOCK_INITIAL' &&
              lot.lotParentId !== null &&
              !sourceLots.some((sourceLot) => sourceLot.lot.id === lot.lotParentId),
          );

          if (reportsSansParentAttendu.length > 0) {
            throw new ConflictException(
              `Un lot reporté existe déjà pour ${cle} avec un lot parent différent; vérification manuelle requise`,
            );
          }

          if (dejaReporte.length !== new Set(dejaReporte.map((lot) => lot.lotParentId)).size) {
            throw new ConflictException(
              `Plusieurs lots cibles correspondent à un même lot source (${cle})`,
            );
          }

          let quantiteDejaReporte = new Prisma.Decimal(0);
          for (const lotCible of dejaReporte) {
            const parent = sourceLots.find((lot) => lot.lot.id === lotCible.lotParentId)!;
            if (
              !new Prisma.Decimal(lotCible.quantiteInitiale).equals(parent.quantite) ||
              new Prisma.Decimal(lotCible.quantiteRestante).lessThan(0) ||
              new Prisma.Decimal(lotCible.quantiteRestante).greaterThan(lotCible.quantiteInitiale)
            ) {
              throw new ConflictException(
                `Le lot reporté ${lotCible.id} ne correspond plus au lot source ${parent.lot.id}`,
              );
            }
            quantiteDejaReporte = quantiteDejaReporte.plus(lotCible.quantiteInitiale);
          }

          const quantiteAttendue = groupe.quantite;

          const lotsRacinesCibles = cible.lotsStock.filter(
            (lot) =>
              lot.articleId === groupe.articleId &&
              new Prisma.Decimal(lot.prixUnitaire).equals(groupe.prix) &&
              lot.typeOrigine === 'STOCK_INITIAL' &&
              lot.lotParentId === null,
          );
          if (lotsRacinesCibles.length > 0) {
            throw new ConflictException(
              `Un lot STOCK_INITIAL racine existe déjà pour ${cle}; vérification manuelle requise`,
            );
          }

          const ouvertureCible = detailCible
            ? new Prisma.Decimal(detailCible.existantDebut)
            : new Prisma.Decimal(0);
          if (
            !ouvertureCible.isZero() &&
            !ouvertureCible.equals(quantiteAttendue)
          ) {
            throw new ConflictException(
              `L’ouverture du Compte Matière diffère du stock source pour ${cle}; report annulé`,
            );
          }

          for (const sourceItem of sourceLots) {
            const sourceLot = sourceItem.lot;
            const lotCible = dejaReporte.find(
              (lot) => lot.lotParentId === sourceLot.id,
            );
            if (lotCible) continue;
            const quantite = new Prisma.Decimal(sourceItem.quantite);
            nouveauxLots.push({
              articleId: sourceLot.articleId,
              prixUnitaire: new Prisma.Decimal(sourceLot.prixUnitaire),
              lotParentId: sourceLot.id,
              quantiteInitiale: quantite,
              quantiteRestante: quantite,
            });
          }

          detailsAReporter.push({
            articleId: groupe.articleId,
            prixUnitaire: groupe.prix,
            quantite: quantiteAttendue,
          });
        }

        for (const lot of nouveauxLots) {
          await tx.lotStock.create({
            data: {
              articleId: lot.articleId,
              exerciceId: cible.id,
              typeOrigine: 'STOCK_INITIAL',
              dateOrigine: cible.dateDebut,
              quantiteInitiale: lot.quantiteInitiale,
              quantiteRestante: lot.quantiteRestante,
              prixUnitaire: lot.prixUnitaire,
              lotParentId: lot.lotParentId,
            },
          });
        }

        let detailsCrees = 0;
        let detailsMisAJour = 0;
        const compteCible = cible.compteMatiere;
        // Référence d'observation du Compte Matière source, par article+prix :
        // un stock reporté conserve l'observation de son détail d'origine.
        const observationsSourceParCle = new Map(
          (source.compteMatiere?.details ?? []).map((ligne) => [
            cleStock(ligne.articleId, new Prisma.Decimal(ligne.prixUnitaire)),
            ligne.observation,
          ]),
        );
        if (compteCible) {
          for (const detail of detailsAReporter) {
            const actuel = compteCible.details.find(
              (ligne) =>
                ligne.articleId === detail.articleId &&
                new Prisma.Decimal(ligne.prixUnitaire).equals(
                  detail.prixUnitaire,
                ),
            );
            const mouvementsCibles = await tx.mouvement.findMany({
              where: {
                exerciceId: cible.id,
                articleId: detail.articleId,
                prixUnitaire: detail.prixUnitaire,
              },
              select: { id: true, type: true, quantite: true },
            });
            const entreesMouvements = mouvementsCibles
              .filter((mouvement) => mouvement.type === 'ENTREE')
              .reduce(
                (total, mouvement) => total.plus(mouvement.quantite),
                new Prisma.Decimal(0),
              );
            const sortiesMouvements = mouvementsCibles
              .filter((mouvement) => mouvement.type === 'SORTIE')
              .reduce(
                (total, mouvement) => total.plus(mouvement.quantite),
                new Prisma.Decimal(0),
              );
            if (!actuel) {
              // Le stock reporté conserve l'observation de son détail
              // d'origine ; la mention générique ne sert que de repli
              // quand la source n'en porte aucune. Un détail existant
              // n'est jamais retouché (voir branches ci-dessous).
              const observationSource = observationsSourceParCle.get(
                cleStock(detail.articleId, detail.prixUnitaire),
              );
              const observationReport =
                observationSource && observationSource.trim().length > 0
                  ? observationSource
                  : `Stock reporté de l’exercice ${source.annee}`;
              await tx.detailCompteMatiere.create({
                data: {
                  compteMatiereId: compteCible.id,
                  articleId: detail.articleId,
                  prixUnitaire: detail.prixUnitaire,
                  existantDebut: detail.quantite,
                  entrees: entreesMouvements,
                  sorties: sortiesMouvements,
                  observation: observationReport,
                },
              });
              detailsCrees += 1;
            } else if (new Prisma.Decimal(actuel.existantDebut).isZero()) {
              await tx.detailCompteMatiere.update({
                where: { id: actuel.id },
                data: {
                  existantDebut: detail.quantite,
                  entrees: entreesMouvements,
                  sorties: sortiesMouvements,
                },
              });
              detailsMisAJour += 1;
            } else {
              const entreesCompte = new Prisma.Decimal(actuel.entrees);
              const sortiesCompte = new Prisma.Decimal(actuel.sorties);
              if (
                (!entreesCompte.isZero() &&
                  !entreesCompte.equals(entreesMouvements)) ||
                (!sortiesCompte.isZero() &&
                  !sortiesCompte.equals(sortiesMouvements))
              ) {
                throw new ConflictException(
                  `Les mouvements et le détail du Compte Matière divergent pour ${detail.articleId}:${detail.prixUnitaire.toString()}`,
                );
              }
              if (
                (entreesCompte.isZero() && !entreesMouvements.isZero()) ||
                (sortiesCompte.isZero() && !sortiesMouvements.isZero())
              ) {
                await tx.detailCompteMatiere.update({
                  where: { id: actuel.id },
                  data: {
                    entrees: entreesMouvements,
                    sorties: sortiesMouvements,
                  },
                });
                detailsMisAJour += 1;
              }
            }
          }
        }

        const sortiesFIFOCompletes = await this.recalculerLotsEtSortiesExercice(
          tx,
          cible.id,
        );

        if (
          cible.compteMatiere && (
          nouveauxLots.length > 0 ||
          detailsCrees > 0 ||
          detailsMisAJour > 0
          )
        ) {
          await this.recalculerValeursCompteMatiere(tx, cible.compteMatiere.id);
        }

        return {
          exerciceSource: { id: source.id, annee: source.annee },
          exerciceCible: { id: cible.id, annee: cible.annee },
          lotsCrees: nouveauxLots.length,
          detailsCrees,
          detailsMisAJour,
          sortiesFIFOCompletes,
          quantitesReportees: detailsAReporter.map((detail) => ({
            articleId: detail.articleId,
            prixUnitaire: detail.prixUnitaire.toString(),
            quantite: detail.quantite.toString(),
          })),
          idempotent: nouveauxLots.length === 0 && detailsCrees === 0 && detailsMisAJour === 0,
        };
    };

    if (transaction) return effectuerReport(transaction);
    return this.prisma.$transaction(effectuerReport, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  private async recalculerLotsEtSortiesExercice(
    tx: Prisma.TransactionClient,
    exerciceId: number,
  ) {
    let lots = await tx.lotStock.findMany({
      where: { exerciceId },
      orderBy: [{ dateOrigine: 'asc' }, { id: 'asc' }],
    });
    const mouvements = await tx.mouvement.findMany({
      where: { exerciceId },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        date: true,
        articleId: true,
        prixUnitaire: true,
        quantite: true,
        observation: true,
      },
    });

    // Les lots d'entrée sont matérialisés à partir des mouvements réels
    // manquants; aucun mouvement n'est créé par le report.
    for (const mouvement of mouvements.filter((item) => item.type === 'ENTREE')) {
      if (lots.some((lot) => lot.mouvementEntreeId === mouvement.id)) continue;
      await tx.lotStock.create({
        data: {
          articleId: mouvement.articleId,
          exerciceId,
          typeOrigine: 'ENTREE',
          mouvementEntreeId: mouvement.id,
          dateOrigine: mouvement.date,
          quantiteInitiale: mouvement.quantite,
          quantiteRestante: mouvement.quantite,
          prixUnitaire: mouvement.prixUnitaire,
          ...ecritureObservationLot(mouvement.observation),
        },
      });
    }

    lots = await tx.lotStock.findMany({
      where: { exerciceId },
      orderBy: [{ dateOrigine: 'asc' }, { id: 'asc' }],
    });

    const clesAvecLotEnfant = new Set(
      lots
        .filter((lot) => lot.typeOrigine === 'STOCK_INITIAL' && lot.lotParentId !== null)
        .map((lot) => `${lot.articleId}:${new Prisma.Decimal(lot.prixUnitaire).toFixed(2)}`),
    );
    lots = lots.filter(
      (lot) =>
        !(
          lot.typeOrigine === 'STOCK_INITIAL' &&
          lot.lotParentId === null &&
          lot.detailCompteMatiereId !== null &&
          clesAvecLotEnfant.has(
            `${lot.articleId}:${new Prisma.Decimal(lot.prixUnitaire).toFixed(2)}`,
          )
        ),
    );

    const sorties = mouvements.filter((item) => item.type === 'SORTIE');
    const affectations = sorties.length > 0
      ? await tx.affectationSortie.findMany({
          where: { mouvementSortieId: { in: sorties.map((item) => item.id) } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      : [];
    const affectationsParSortie = new Map<number, typeof affectations>();
    for (const affectation of affectations) {
      const groupe = affectationsParSortie.get(affectation.mouvementSortieId) ?? [];
      groupe.push(affectation);
      affectationsParSortie.set(affectation.mouvementSortieId, groupe);
    }

    const soldes = new Map<number, Prisma.Decimal>();
    for (const lot of lots) {
      const initiale = new Prisma.Decimal(lot.quantiteInitiale);
      const actuelle = new Prisma.Decimal(lot.quantiteRestante);
      if (initiale.lessThan(0) || actuelle.lessThan(0) || actuelle.greaterThan(initiale)) {
        throw new ConflictException(`Lot ${lot.id} incohérent; report annulé`);
      }
      soldes.set(lot.id, initiale);
    }

    const nouvellesAffectations: Array<{
      mouvementSortieId: number;
      lotStockId: number;
      quantite: Prisma.Decimal;
    }> = [];

    for (const sortie of sorties) {
      const existantes = affectationsParSortie.get(sortie.id) ?? [];
      let dejaAffectee = new Prisma.Decimal(0);
      for (const affectation of existantes) {
        const lot = lots.find((item) => item.id === affectation.lotStockId);
        const quantite = new Prisma.Decimal(affectation.quantite);
        if (
          !lot ||
          lot.articleId !== sortie.articleId ||
          !new Prisma.Decimal(lot.prixUnitaire).equals(sortie.prixUnitaire) ||
          lot.dateOrigine > sortie.date ||
          quantite.lessThanOrEqualTo(0)
        ) {
          throw new ConflictException(
            `Affectation FIFO existante incohérente pour la sortie ${sortie.id}`,
          );
        }
        const disponible = soldes.get(lot.id) ?? new Prisma.Decimal(0);
        if (quantite.greaterThan(disponible)) {
          throw new ConflictException(
            `La sortie ${sortie.id} dépasse le solde du lot ${lot.id}`,
          );
        }
        soldes.set(lot.id, disponible.minus(quantite));
        dejaAffectee = dejaAffectee.plus(quantite);
      }

      const quantiteSortie = new Prisma.Decimal(sortie.quantite);
      if (dejaAffectee.greaterThan(quantiteSortie)) {
        throw new ConflictException(
          `Les affectations dépassent la quantité de la sortie ${sortie.id}`,
        );
      }
      let reste = quantiteSortie.minus(dejaAffectee);

      const candidats = lots.filter(
        (lot) =>
          lot.articleId === sortie.articleId &&
          new Prisma.Decimal(lot.prixUnitaire).equals(sortie.prixUnitaire) &&
          lot.dateOrigine <= sortie.date,
      );
      for (const lot of candidats) {
        if (reste.isZero()) break;
        const disponible = soldes.get(lot.id) ?? new Prisma.Decimal(0);
        if (disponible.isZero()) continue;
        const quantite = Prisma.Decimal.min(reste, disponible);
        soldes.set(lot.id, disponible.minus(quantite));
        reste = reste.minus(quantite);
        nouvellesAffectations.push({
          mouvementSortieId: sortie.id,
          lotStockId: lot.id,
          quantite,
        });
      }

      if (reste.greaterThan(0)) {
        throw new BadRequestException(
          `Stock insuffisant pour la sortie ${sortie.id}; quantité non affectée : ${reste.toString()}`,
        );
      }
    }

    for (const affectation of nouvellesAffectations) {
      await tx.affectationSortie.create({ data: affectation });
    }

    for (const lot of lots) {
      const attendue = soldes.get(lot.id) ?? new Prisma.Decimal(0);
      const actuelle = new Prisma.Decimal(lot.quantiteRestante);
      if (attendue.greaterThan(actuelle)) {
        throw new ConflictException(
          `Le solde du lot ${lot.id} est inférieur aux mouvements enregistrés; vérification requise`,
        );
      }
      if (!attendue.equals(actuelle)) {
        await tx.lotStock.update({
          where: { id: lot.id },
          data: { quantiteRestante: attendue },
        });
      }
    }

    return nouvellesAffectations.length;
  }

  async findAll(userId: number) {
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

    const where =
      user.role === Role.DEPOSITEUR_COMPTABLE
        ? {
            exercice: {
              soaId: user.soaId,
            },
          }
        : {};

    return this.prisma.mouvement.findMany({
      where,
      include: {
        article: {
          include: {
            nomenclature: true,
          },
        },
        exercice: {
          include: {
            soa: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async findOne(
    id: number,
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

    const mouvement =
      await this.prisma.mouvement.findUnique({
        where: {
          id,
        },
        include: {
          article: {
            include: {
              nomenclature: true,
            },
          },
          exercice: {
            include: {
              soa: true,
            },
          },
        },
      });

    if (!mouvement) {
      throw new NotFoundException(
        'Mouvement introuvable',
      );
    }

    if (
      user.role === Role.DEPOSITEUR_COMPTABLE &&
      mouvement.exercice.soaId !== user.soaId
    ) {
      throw new NotFoundException(
        'Mouvement introuvable',
      );
    }

    return mouvement;
  }
}
