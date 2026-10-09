
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StockReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifierAccesSoa(soaId: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (
      user.role === Role.DEPOSITEUR_COMPTABLE &&
      user.soaId !== soaId
    ) {
      throw new NotFoundException('SOA introuvable');
    }

    if (
      user.role !== Role.DEPOSITEUR_COMPTABLE &&
      user.role !== Role.COMPTABLE &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Accès au rapport de stock refusé');
    }

    const soa = await this.prisma.sOA.findUnique({
      where: { id: soaId },
      select: { id: true },
    });
    if (!soa) {
      throw new NotFoundException('SOA introuvable');
    }
  }

  /**
   * Mamerina mikajy ny valeur an'ny Compte Matière
   * araka ny détails enregistrés.
   */
  async recalculerValeursCompteMatiere(
    compteMatiereId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const compte = await tx.compteMatiere.findUnique({
      where: { id: compteMatiereId },
      include: {
        details: true,
        exercice: true,
      },
    });

    if (!compte) {
      throw new NotFoundException(
        `Compte Matière ${compteMatiereId} introuvable.`,
      );
    }

    let valeurExistanteDebut = new Prisma.Decimal(0);
    let valeurEntrees = new Prisma.Decimal(0);
    let valeurSorties = new Prisma.Decimal(0);

    for (const detail of compte.details) {
      const prix = new Prisma.Decimal(detail.prixUnitaire);

      valeurExistanteDebut = valeurExistanteDebut.plus(
        new Prisma.Decimal(detail.existantDebut).mul(prix),
      );

      valeurEntrees = valeurEntrees.plus(
        new Prisma.Decimal(detail.entrees).mul(prix),
      );

      valeurSorties = valeurSorties.plus(
        new Prisma.Decimal(detail.sorties).mul(prix),
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
      include: {
        exercice: {
          include: { soa: true },
        },
        details: {
          include: {
            article: {
              include: { nomenclature: true },
            },
          },
        },
      },
    });
  }

  /**
   * Maka ny exercices sy comptes matière an'ny SOA iray,
   * araka ny filaharan'ny taona.
   *
   * Lecture uniquement : tsy manova données.
   */
  async obtenirChronologie(soaId: number) {
    const exercices = await this.prisma.exercice.findMany({
      where: { soaId },
      orderBy: [{ annee: 'asc' }, { id: 'asc' }],
      include: {
        compteMatiere: {
          include: {
            details: {
              include: {
                article: {
                  include: { nomenclature: true },
                },
              },
              orderBy: [
                { article: { nomenclature: { code: 'asc' } } },
                { article: { designation: 'asc' } },
                { prixUnitaire: 'asc' },
              ],
            },
          },
        },
        mouvements: {
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          include: {
            article: true,
          },
        },
        lotsStock: {
          orderBy: [{ dateOrigine: 'asc' }, { id: 'asc' }],
          include: { article: true },
        },
      },
    });

    return exercices.map((exercice) => ({
      exerciceId: exercice.id,
      annee: exercice.annee,
      soaId: exercice.soaId,
      compteMatiereId: exercice.compteMatiere?.id ?? null,
      details: exercice.compteMatiere?.details ?? [],
      mouvements: exercice.mouvements,
      lotsStock: exercice.lotsStock,
    }));
  }

  /**
   * Affiche la chronologie des stocks sans modifier la base.
   */
  async simulerChronologie(soaId: number, userId: number) {
    await this.verifierAccesSoa(soaId, userId);
    const chronologie = await this.obtenirChronologie(soaId);

    return {
      soaId,
      nombreExercices: chronologie.length,
      exercicesAvecCompte: chronologie.filter(
        (exercice) => exercice.compteMatiereId !== null,
      ).length,
      exercicesSansCompte: chronologie.filter(
        (exercice) => exercice.compteMatiereId === null,
      ).map((exercice) => ({
        exerciceId: exercice.exerciceId,
        annee: exercice.annee,
      })),
      chronologie: chronologie.map((exercice) => ({
        exerciceId: exercice.exerciceId,
        annee: exercice.annee,
        compteMatiereId: exercice.compteMatiereId,
        nombreDetails: exercice.details.length,
        nombreMouvements: exercice.mouvements.length,
      })),
    };
  }
  
  /**
   * Simule le report de stock par SOA, article et prix.
   * Lecture uniquement : aucune donnée n'est modifiée.
   */



async simulerReportStock(soaId: number, userId: number) {
  await this.verifierAccesSoa(soaId, userId);
  const exercices = await this.obtenirChronologie(soaId);

  type LigneStock = {
    articleId: number;
    designation: string;
    prixUnitaire: Prisma.Decimal;
    stockInitialEnregistre: Prisma.Decimal;
    stockInitialCalcule: Prisma.Decimal;
    entrees: Prisma.Decimal;
    sorties: Prisma.Decimal;
    stockFinal: Prisma.Decimal;
    stockFinalLots: Prisma.Decimal | null;
    ecartEntreesDetailsMouvements: Prisma.Decimal | null;
    ecartSortiesDetailsMouvements: Prisma.Decimal | null;
    ecartStockFinalLots: Prisma.Decimal | null;
    source: string[];
  };

  const soldes = new Map<string, Prisma.Decimal>();
  const infos = new Map<
    string,
    { articleId: number; designation: string; prix: Prisma.Decimal }
  >();

  const cleStock = (articleId: number, prix: Prisma.Decimal) =>
    `${articleId}:${prix.toFixed(2)}`;

  const zero = () => new Prisma.Decimal(0);

  const resultats: Array<{
    exerciceId: number;
    annee: number;
    lignes: LigneStock[];
  }> = [];

  for (const exercice of exercices) {
    const lignes = new Map<string, LigneStock>();
    const reportsParCle = new Map<
      string,
      { quantite: Prisma.Decimal; ids: number[] }
    >();

    const obtenirLigne = (
      articleId: number,
      designation: string,
      prix: Prisma.Decimal,
    ) => {
      const cle = cleStock(articleId, prix);
      let ligne = lignes.get(cle);

      infos.set(cle, { articleId, designation, prix });

      if (!ligne) {
        const precedent = soldes.get(cle) ?? zero();

        ligne = {
          articleId,
          designation,
          prixUnitaire: new Prisma.Decimal(prix),
          stockInitialEnregistre: zero(),
          stockInitialCalcule: new Prisma.Decimal(precedent),
          entrees: zero(),
          sorties: zero(),
          stockFinal: zero(),
          stockFinalLots: null,
          ecartEntreesDetailsMouvements: null,
          ecartSortiesDetailsMouvements: null,
          ecartStockFinalLots: null,
          source: [],
        };

        lignes.set(cle, ligne);
      }

      return ligne;
    };

    // 1. Reporter tous les stocks précédents,
    // même si cet exercice n'a aucune opération.
    for (const [cle, solde] of soldes.entries()) {
      const info = infos.get(cle);
      if (!info) continue;

      const ligne = obtenirLigne(
        info.articleId,
        info.designation,
        info.prix,
      );

      ligne.stockInitialCalcule = new Prisma.Decimal(solde);
      ligne.source.push('REPORT_EXERCICE_PRECEDENT');
    }

    // Un lot enfant matérialise déjà le stock reporté depuis son parent.
    // Il remplace le solde précédent pour l'ouverture de cet exercice ;
    // l'ajouter au solde précédent compterait le report deux fois.
    for (const lot of exercice.lotsStock) {
      if (lot.lotParentId === null) continue;

      const prix = new Prisma.Decimal(lot.prixUnitaire);
      const cle = cleStock(lot.articleId, prix);
      const report = reportsParCle.get(cle) ?? {
        quantite: zero(),
        ids: [],
      };

      report.quantite = report.quantite.plus(lot.quantiteInitiale);
      report.ids.push(lot.id);
      reportsParCle.set(cle, report);

      obtenirLigne(
        lot.articleId,
        lot.article.designation,
        prix,
      );
    }

    for (const [cle, report] of reportsParCle.entries()) {
      const ligne = lignes.get(cle);
      if (!ligne) continue;

      const soldePrecedent = soldes.get(cle);
      const aSoldePrecedent = soldes.has(cle);
      if (
        aSoldePrecedent &&
        soldePrecedent &&
        !soldePrecedent.equals(report.quantite)
      ) {
        ligne.source.push(
          `ECART_REPORT_LOTS:calcule(${soldePrecedent.toString()})-lots(${report.quantite.toString()})`,
        );
      } else {
        // Le lot reporté confirme le solde chronologique s'il correspond.
        // En cas d'écart, conserver le solde calculé depuis l'exercice
        // précédent et signaler le lot divergent sans propager son erreur.
        ligne.stockInitialCalcule = new Prisma.Decimal(report.quantite);
      }

      ligne.source.push(`REPORT_LOTS_ENFANTS:${report.ids.join(',')}`);
    }

    // 2. Charger les détails existants.
    const fluxDetails = new Map<
      string,
      { entrees: Prisma.Decimal; sorties: Prisma.Decimal }
    >();

    for (const detail of exercice.details) {
      const prix = new Prisma.Decimal(detail.prixUnitaire);
      const ligne = obtenirLigne(
        detail.articleId,
        detail.article.designation,
        prix,
      );

      ligne.stockInitialEnregistre =
        ligne.stockInitialEnregistre.plus(detail.existantDebut);

      const cle = cleStock(detail.articleId, prix);
      const flux = fluxDetails.get(cle) ?? {
        entrees: zero(),
        sorties: zero(),
      };

      flux.entrees = flux.entrees.plus(detail.entrees);
      flux.sorties = flux.sorties.plus(detail.sorties);
      fluxDetails.set(cle, flux);

      ligne.source.push(`DETAIL:${detail.id}`);
    }

    // 3. Agréger les mouvements par article et prix.
    const fluxMouvements = new Map<
      string,
      {
        entrees: Prisma.Decimal;
        sorties: Prisma.Decimal;
        ids: number[];
        aEntree: boolean;
        aSortie: boolean;
      }
    >();

    for (const mouvement of exercice.mouvements) {
      const prix = new Prisma.Decimal(mouvement.prixUnitaire);
      const cle = cleStock(mouvement.articleId, prix);

      obtenirLigne(
        mouvement.articleId,
        mouvement.article.designation,
        prix,
      );

      const flux = fluxMouvements.get(cle) ?? {
        entrees: zero(),
        sorties: zero(),
        ids: [],
        aEntree: false,
        aSortie: false,
      };

      const quantite = new Prisma.Decimal(mouvement.quantite);

      if (mouvement.type === 'ENTREE') {
        flux.entrees = flux.entrees.plus(quantite);
        flux.aEntree = true;
      } else {
        flux.sorties = flux.sorties.plus(quantite);
        flux.aSortie = true;
      }

      flux.ids.push(mouvement.id);
      fluxMouvements.set(cle, flux);
    }

    // 4. Utiliser les mouvements s'ils existent, sinon les détails.
    // Comparer les totaux sans additionner les sources potentiellement dupliquées.
    const toutesLesCles = new Set([
      ...fluxDetails.keys(),
      ...fluxMouvements.keys(),
    ]);

    for (const cle of toutesLesCles) {
      const detail = fluxDetails.get(cle) ?? {
        entrees: zero(),
        sorties: zero(),
      };

      const mouvement = fluxMouvements.get(cle) ?? {
        entrees: zero(),
        sorties: zero(),
        ids: [],
        aEntree: false,
        aSortie: false,
      };

      const ligne = lignes.get(cle);
      if (!ligne) continue;

      ligne.entrees = mouvement.aEntree
        ? mouvement.entrees
        : detail.entrees;
      ligne.sorties = mouvement.aSortie
        ? mouvement.sorties
        : detail.sorties;

      if (fluxDetails.has(cle) && mouvement.aEntree) {
        ligne.ecartEntreesDetailsMouvements = detail.entrees.minus(
          mouvement.entrees,
        );
      }

      if (fluxDetails.has(cle) && mouvement.aSortie) {
        ligne.ecartSortiesDetailsMouvements = detail.sorties.minus(
          mouvement.sorties,
        );
      }

      if (mouvement.ids.length > 0) {
        ligne.source.push(
          `MOUVEMENTS:${mouvement.ids.join(',')}`,
        );
      }

      if (
        (mouvement.aEntree &&
          !detail.entrees.equals(mouvement.entrees)) ||
        (mouvement.aSortie &&
          !detail.sorties.equals(mouvement.sorties))
      ) {
        ligne.source.push(
          `ECART_A_VERIFIER:details(${detail.entrees.toString()}/${detail.sorties.toString()})-mouvements(${mouvement.entrees.toString()}/${mouvement.sorties.toString()})`,
        );
      }
    }

    // 5. Calculer le stock final et préparer le report suivant.
    const soldesLots = new Map<string, Prisma.Decimal>();

    for (const lot of exercice.lotsStock) {
      const prix = new Prisma.Decimal(lot.prixUnitaire);
      const cle = cleStock(lot.articleId, prix);
      const ligne = obtenirLigne(
        lot.articleId,
        lot.article.designation,
        prix,
      );
      const soldeLot = soldesLots.get(cle) ?? zero();
      soldesLots.set(cle, soldeLot.plus(lot.quantiteRestante));
      ligne.stockFinalLots = zero();
    }

    for (const [cle, ligne] of lignes.entries()) {
      // S'il n'existe aucun stock antérieur pour ce lot,
      // utiliser le stock initial enregistré dans le compte.
      if (!soldes.has(cle)) {
        ligne.stockInitialCalcule = new Prisma.Decimal(
          ligne.stockInitialEnregistre,
        );
      }

      ligne.stockFinal = ligne.stockInitialCalcule
        .plus(ligne.entrees)
        .minus(ligne.sorties);

      const stockFinalLots = soldesLots.get(cle);
      if (stockFinalLots !== undefined) {
        ligne.stockFinalLots = new Prisma.Decimal(stockFinalLots);
        ligne.ecartStockFinalLots = ligne.stockFinal.minus(stockFinalLots);

        if (!ligne.ecartStockFinalLots.isZero()) {
          ligne.source.push(
            `ECART_STOCK_LOTS:calcule(${ligne.stockFinal.toString()})-lots(${stockFinalLots.toString()})`,
          );
        }
      }

      soldes.set(cle, new Prisma.Decimal(ligne.stockFinal));
    }

    resultats.push({
      exerciceId: exercice.exerciceId,
      annee: exercice.annee,
      lignes: Array.from(lignes.values()),
    });
  }

  return {
    soaId,
    lectureSeule: true,
    avertissement:
      'Simulation uniquement. Les mouvements servent au calcul des flux lorsqu’ils existent ; les détails servent de repli. Les écarts avec les détails et les lots sont signalés pour vérification. Aucune donnée ni affectation réelle n’est modifiée.',
    exercices: resultats.map((exercice) => ({
      exerciceId: exercice.exerciceId,
      annee: exercice.annee,
      lignes: exercice.lignes.map((ligne) => ({
        articleId: ligne.articleId,
        designation: ligne.designation,
        prixUnitaire: ligne.prixUnitaire.toString(),
        stockInitialEnregistre:
          ligne.stockInitialEnregistre.toString(),
        stockInitialCalcule:
          ligne.stockInitialCalcule.toString(),
        entrees: ligne.entrees.toString(),
        sorties: ligne.sorties.toString(),
        stockFinal: ligne.stockFinal.toString(),
        stockFinalLots: ligne.stockFinalLots?.toString() ?? null,
        ecartEntreesDetailsMouvements:
          ligne.ecartEntreesDetailsMouvements?.toString() ?? null,
        ecartSortiesDetailsMouvements:
          ligne.ecartSortiesDetailsMouvements?.toString() ?? null,
        ecartStockFinalLots: ligne.ecartStockFinalLots?.toString() ?? null,
        ecartStockInitial: ligne.stockInitialEnregistre
          .minus(ligne.stockInitialCalcule)
          .toString(),
        stockNegatif: ligne.stockFinal.lessThan(0),
        source: ligne.source,
      })),
    })),
  };
}




}
