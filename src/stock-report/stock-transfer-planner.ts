import { Prisma, TypeOrigineLot } from '@prisma/client';

export type StockTransferExercise = {
  id: number;
  annee: number;
  soaId: number;
  compteMatiereId: number | null;
  details: Array<{
    id: number;
    articleId: number;
    prixUnitaire: Prisma.Decimal;
    existantDebut: Prisma.Decimal;
    entrees: Prisma.Decimal;
    sorties: Prisma.Decimal;
  }>;
  mouvements: Array<{
    id: number;
    articleId: number;
    designation: string;
    prixUnitaire: Prisma.Decimal;
    quantite: Prisma.Decimal;
    date: Date;
    type: 'ENTREE' | 'SORTIE';
  }>;
};

export type StockLotPlan = {
  key: string;
  parentKey: string | null;
  sourceType: TypeOrigineLot;
  sourceId: number;
  exerciceId: number;
  annee: number;
  soaId: number;
  articleId: number;
  prixUnitaire: Prisma.Decimal;
  dateOrigine: Date;
  quantiteInitiale: Prisma.Decimal;
  quantiteRestante: Prisma.Decimal;
  mouvementEntreeId?: number;
  detailCompteMatiereId?: number;
};

export type DetailReportPlan = {
  compteMatiereId: number;
  articleId: number;
  prixUnitaire: Prisma.Decimal;
  existantDebut: Prisma.Decimal;
  detailId: number | null;
  entreesPourCreation: Prisma.Decimal;
  sortiesPourCreation: Prisma.Decimal;
};

export type AffectationPlan = {
  mouvementSortieId: number;
  lotKey: string;
  quantite: Prisma.Decimal;
};

export type StockTransferPlan = {
  lots: StockLotPlan[];
  affectations: AffectationPlan[];
  detailsReportes: DetailReportPlan[];
};

const zero = () => new Prisma.Decimal(0);
const stockKey = (articleId: number, price: Prisma.Decimal) =>
  `${articleId}:${price.toFixed(2)}`;

/** Pure chronological planner used by the dry-run/apply reconciliation script. */
export function planifierReportStock(
  exercices: StockTransferExercise[],
): StockTransferPlan {
  const ordonnes = [...exercices].sort(
    (a, b) => a.soaId - b.soaId || a.annee - b.annee || a.id - b.id,
  );
  const parSoa = new Map<number, StockTransferExercise[]>();
  for (const exercice of ordonnes) {
    const groupe = parSoa.get(exercice.soaId) ?? [];
    groupe.push(exercice);
    parSoa.set(exercice.soaId, groupe);
  }

  const lots: StockLotPlan[] = [];
  const affectations: AffectationPlan[] = [];
  const detailsReportes: DetailReportPlan[] = [];
  const entrants = new Map<number, StockLotPlan[]>();

  for (const exercicesSoa of parSoa.values()) {
    for (let index = 0; index < exercicesSoa.length; index += 1) {
      const exercice = exercicesSoa[index];
      const suivant = exercicesSoa[index + 1];
      const lotsExercice = [...(entrants.get(exercice.id) ?? [])];
      const incomingParCle = new Map<string, Prisma.Decimal>();

      for (const lot of lotsExercice) {
        const cle = stockKey(lot.articleId, lot.prixUnitaire);
        incomingParCle.set(
          cle,
          (incomingParCle.get(cle) ?? zero()).plus(lot.quantiteInitiale),
        );
      }

      const detailsParCle = new Map(
        exercice.details.map((detail) => [
          stockKey(detail.articleId, detail.prixUnitaire),
          detail,
        ]),
      );

      if (exercice.compteMatiereId !== null) {
        for (const [cle, report] of incomingParCle) {
          const detail = detailsParCle.get(cle);
          if (
            detail &&
            !detail.existantDebut.isZero() &&
            !detail.existantDebut.equals(report)
          ) {
            throw new Error(
              `Ouverture ambiguë pour exercice ${exercice.annee}, article/prix ${cle}: détail ${detail.existantDebut.toString()}, report ${report.toString()}`,
            );
          }

          const mouvementFlux = exercice.mouvements
            .filter(
              (mouvement) =>
                stockKey(mouvement.articleId, mouvement.prixUnitaire) === cle,
            )
            .reduce(
              (flux, mouvement) => {
                if (mouvement.type === 'ENTREE') {
                  flux.entrees = flux.entrees.plus(mouvement.quantite);
                } else {
                  flux.sorties = flux.sorties.plus(mouvement.quantite);
                }
                return flux;
              },
              { entrees: zero(), sorties: zero() },
            );

          if (!detail || !detail.existantDebut.equals(report)) {
            detailsReportes.push({
              compteMatiereId: exercice.compteMatiereId,
              articleId: Number(cle.split(':')[0]),
              prixUnitaire: new Prisma.Decimal(
                lotsExercice.find((lot) => stockKey(lot.articleId, lot.prixUnitaire) === cle)!
                  .prixUnitaire,
              ),
              existantDebut: report,
              detailId: detail?.id ?? null,
              entreesPourCreation: mouvementFlux.entrees,
              sortiesPourCreation: mouvementFlux.sorties,
            });
          }
        }
      }

      // Un solde reporté est le stock d'ouverture du compte, pas un second
      // lot à ajouter au détail existant : les lots descendants font foi.
      for (const detail of exercice.details) {
        const cle = stockKey(detail.articleId, detail.prixUnitaire);
        if (incomingParCle.has(cle) || detail.existantDebut.lessThanOrEqualTo(0)) {
          continue;
        }
        const lot: StockLotPlan = {
          key: `detail:${detail.id}`,
          parentKey: null,
          sourceType: 'STOCK_INITIAL',
          sourceId: detail.id,
          exerciceId: exercice.id,
          annee: exercice.annee,
          soaId: exercice.soaId,
          articleId: detail.articleId,
          prixUnitaire: new Prisma.Decimal(detail.prixUnitaire),
          dateOrigine: new Date(Date.UTC(exercice.annee, 0, 1)),
          quantiteInitiale: new Prisma.Decimal(detail.existantDebut),
          quantiteRestante: new Prisma.Decimal(detail.existantDebut),
          detailCompteMatiereId: detail.id,
        };
        lots.push(lot);
        lotsExercice.push(lot);
      }

      const mouvementsEntree = exercice.mouvements
        .filter((mouvement) => mouvement.type === 'ENTREE')
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id);
      for (const mouvement of mouvementsEntree) {
        const lot: StockLotPlan = {
          key: `mouvement:${mouvement.id}`,
          parentKey: null,
          sourceType: 'ENTREE',
          sourceId: mouvement.id,
          exerciceId: exercice.id,
          annee: exercice.annee,
          soaId: exercice.soaId,
          articleId: mouvement.articleId,
          prixUnitaire: new Prisma.Decimal(mouvement.prixUnitaire),
          dateOrigine: mouvement.date,
          quantiteInitiale: new Prisma.Decimal(mouvement.quantite),
          quantiteRestante: new Prisma.Decimal(mouvement.quantite),
          mouvementEntreeId: mouvement.id,
        };
        lots.push(lot);
        lotsExercice.push(lot);
      }

      const sorties = exercice.mouvements
        .filter((mouvement) => mouvement.type === 'SORTIE')
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id);

      for (const sortie of sorties) {
        let reste = new Prisma.Decimal(sortie.quantite);
        const candidats = lotsExercice
          .filter(
            (lot) =>
              lot.articleId === sortie.articleId &&
              lot.prixUnitaire.equals(sortie.prixUnitaire) &&
              lot.dateOrigine.getTime() <= sortie.date.getTime(),
          )
          .sort(
            (a, b) =>
              a.dateOrigine.getTime() - b.dateOrigine.getTime() ||
              a.sourceId - b.sourceId ||
              a.key.localeCompare(b.key),
          );

        for (const lot of candidats) {
          if (reste.lessThanOrEqualTo(0)) break;
          const quantite = Prisma.Decimal.min(reste, lot.quantiteRestante);
          if (quantite.lessThanOrEqualTo(0)) continue;
          lot.quantiteRestante = lot.quantiteRestante.minus(quantite);
          reste = reste.minus(quantite);
          affectations.push({
            mouvementSortieId: sortie.id,
            lotKey: lot.key,
            quantite,
          });
        }

        if (reste.greaterThan(0)) {
          throw new Error(
            `Sortie ${sortie.id} (${exercice.annee}) : quantité non affectée ${reste.toString()}`,
          );
        }
      }

      if (suivant) {
        for (const source of lotsExercice) {
          if (source.quantiteRestante.lessThanOrEqualTo(0)) continue;
          const enfant: StockLotPlan = {
            key: `report:${source.key}:${suivant.id}`,
            parentKey: source.key,
            sourceType: 'STOCK_INITIAL',
            sourceId: source.sourceId,
            exerciceId: suivant.id,
            annee: suivant.annee,
            soaId: suivant.soaId,
            articleId: source.articleId,
            prixUnitaire: new Prisma.Decimal(source.prixUnitaire),
            dateOrigine: new Date(Date.UTC(source.annee + 1, 0, 1)),
            quantiteInitiale: new Prisma.Decimal(source.quantiteRestante),
            quantiteRestante: new Prisma.Decimal(source.quantiteRestante),
          };
          lots.push(enfant);
          const enfantsSuivants = entrants.get(suivant.id) ?? [];
          enfantsSuivants.push(enfant);
          entrants.set(suivant.id, enfantsSuivants);
        }
      }
    }
  }

  return { lots, affectations, detailsReportes };
}
