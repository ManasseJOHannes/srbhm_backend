import { Prisma, PrismaClient } from '@prisma/client';
import { planifierReportStock } from '../src/stock-report/stock-transfer-planner.js';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function decimal(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(String(value));
}

type PlanReader = Pick<
  PrismaClient,
  'exercice' | 'detailCompteMatiere' | 'mouvement'
>;

async function chargerPlan(db: PlanReader) {
  const exercices = await db.exercice.findMany({
    orderBy: [{ soaId: 'asc' }, { annee: 'asc' }, { id: 'asc' }],
    include: { compteMatiere: { select: { id: true } } },
  });
  const details = await db.detailCompteMatiere.findMany({
    include: {
      article: true,
      compteMatiere: { include: { exercice: true } },
    },
    orderBy: { id: 'asc' },
  });
  const mouvements = await db.mouvement.findMany({
    include: { article: true, exercice: true },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  const detailsParExercice = new Map<number, typeof details>();
  const mouvementsParExercice = new Map<number, typeof mouvements>();

  for (const detail of details) {
    const exerciceId = detail.compteMatiere.exerciceId;
    const lignes = detailsParExercice.get(exerciceId) ?? [];
    lignes.push(detail);
    detailsParExercice.set(exerciceId, lignes);
  }
  for (const mouvement of mouvements) {
    const lignes = mouvementsParExercice.get(mouvement.exerciceId) ?? [];
    lignes.push(mouvement);
    mouvementsParExercice.set(mouvement.exerciceId, lignes);
  }

  const plan = planifierReportStock(
    exercices.map((exercice) => ({
      id: exercice.id,
      annee: exercice.annee,
      soaId: exercice.soaId,
      compteMatiereId: exercice.compteMatiere?.id ?? null,
      details: (detailsParExercice.get(exercice.id) ?? []).map((detail) => ({
        id: detail.id,
        articleId: detail.articleId,
        prixUnitaire: decimal(detail.prixUnitaire),
        existantDebut: decimal(detail.existantDebut),
        entrees: decimal(detail.entrees),
        sorties: decimal(detail.sorties),
      })),
      mouvements: (mouvementsParExercice.get(exercice.id) ?? []).map(
        (mouvement) => ({
          id: mouvement.id,
          articleId: mouvement.articleId,
          designation: mouvement.article.designation,
          prixUnitaire: decimal(mouvement.prixUnitaire),
          quantite: decimal(mouvement.quantite),
          date: mouvement.date,
          type: mouvement.type,
        }),
      ),
    })),
  );

  return { plan };
}

async function appliquerPlan(
  tx: Prisma.TransactionClient,
  plan: Awaited<ReturnType<typeof chargerPlan>>['plan'],
) {
  const lotsExistants = await tx.lotStock.findMany();
  const affectationsExistantes = await tx.affectationSortie.findMany();
  const idsParCle = new Map<string, number>();
  const lotsExistantsUtilises = new Set<number>();
  const affectationsExistantesUtilisees = new Set<number>();

  for (const lot of plan.lots) {
    const parentId = lot.parentKey ? idsParCle.get(lot.parentKey) : null;
    if (lot.parentKey && parentId === undefined) {
      throw new Error(`Parent non résolu pour le lot ${lot.key}.`);
    }

    const candidats = lotsExistants.filter((existant) => {
      if (lot.parentKey) {
        return (
          existant.exerciceId === lot.exerciceId &&
          existant.lotParentId === parentId
        );
      }
      return lot.detailCompteMatiereId
        ? existant.detailCompteMatiereId === lot.detailCompteMatiereId
        : existant.mouvementEntreeId === lot.mouvementEntreeId;
    });
    if (candidats.length > 1) {
      throw new Error(`Plusieurs lots correspondent à ${lot.key}; vérification manuelle requise.`);
    }

    const existant = candidats[0];
    if (existant) {
      const conforme =
        existant.articleId === lot.articleId &&
        existant.exerciceId === lot.exerciceId &&
        existant.typeOrigine === lot.sourceType &&
        decimal(existant.prixUnitaire).equals(lot.prixUnitaire) &&
        decimal(existant.quantiteInitiale).equals(lot.quantiteInitiale) &&
        decimal(existant.quantiteRestante).equals(lot.quantiteRestante) &&
        existant.dateOrigine.getTime() === lot.dateOrigine.getTime() &&
        (lot.parentKey ? existant.lotParentId === parentId : true);
      if (!conforme) {
        throw new Error(`Le lot existant ${existant.id} diffère du report calculé (${lot.key}); aucune correction automatique appliquée.`);
      }
      idsParCle.set(lot.key, existant.id);
      lotsExistantsUtilises.add(existant.id);
      continue;
    }

    const cree = await tx.lotStock.create({
      data: {
        articleId: lot.articleId,
        exerciceId: lot.exerciceId,
        typeOrigine: lot.sourceType,
        dateOrigine: lot.dateOrigine,
        quantiteInitiale: lot.quantiteInitiale,
        quantiteRestante: lot.quantiteRestante,
        prixUnitaire: lot.prixUnitaire,
        mouvementEntreeId: lot.mouvementEntreeId,
        detailCompteMatiereId: lot.detailCompteMatiereId,
        lotParentId: parentId,
      },
    });
    idsParCle.set(lot.key, cree.id);
  }

  const lotsInattendus = lotsExistants.filter(
    (lot) => !lotsExistantsUtilises.has(lot.id),
  );
  if (lotsInattendus.length) {
    throw new Error(
      `Lots existants hors du plan (${lotsInattendus.map((lot) => lot.id).join(', ')}); vérification manuelle requise.`,
    );
  }

  for (const affectation of plan.affectations) {
    const lotStockId = idsParCle.get(affectation.lotKey);
    if (lotStockId === undefined) {
      throw new Error(`Lot non résolu pour la sortie ${affectation.mouvementSortieId}.`);
    }
    const candidats = affectationsExistantes.filter(
      (item) =>
        item.mouvementSortieId === affectation.mouvementSortieId &&
        item.lotStockId === lotStockId,
    );
    if (candidats.length > 1) {
      throw new Error(`Affectations dupliquées pour la sortie ${affectation.mouvementSortieId}.`);
    }
    const existante = candidats[0];
    if (existante) {
      if (!decimal(existante.quantite).equals(affectation.quantite)) {
        throw new Error(`Quantité d'affectation incohérente pour la sortie ${affectation.mouvementSortieId}.`);
      }
      affectationsExistantesUtilisees.add(existante.id);
      continue;
    }
    await tx.affectationSortie.create({
      data: {
        mouvementSortieId: affectation.mouvementSortieId,
        lotStockId,
        quantite: affectation.quantite,
      },
    });
  }

  const affectationsInattendues = affectationsExistantes.filter(
    (item) => !affectationsExistantesUtilisees.has(item.id),
  );
  if (affectationsInattendues.length) {
    throw new Error(
      `Affectations hors du plan (${affectationsInattendues.map((item) => item.id).join(', ')}); vérification manuelle requise.`,
    );
  }

  const comptesModifies = new Set<number>();
  for (const detail of plan.detailsReportes) {
    const where = {
      compteMatiereId_articleId_prixUnitaire: {
        compteMatiereId: detail.compteMatiereId,
        articleId: detail.articleId,
        prixUnitaire: detail.prixUnitaire,
      },
    };
    const courant = await tx.detailCompteMatiere.findUnique({ where });
    if (courant) {
      if (decimal(courant.existantDebut).isZero()) {
        await tx.detailCompteMatiere.update({
          where: { id: courant.id },
          data: { existantDebut: detail.existantDebut },
        });
        comptesModifies.add(detail.compteMatiereId);
      } else if (!decimal(courant.existantDebut).equals(detail.existantDebut)) {
        throw new Error(`Ouverture du détail ${courant.id} modifiée depuis la simulation; aucune correction appliquée.`);
      }
    } else {
      await tx.detailCompteMatiere.create({
        data: {
          compteMatiereId: detail.compteMatiereId,
          articleId: detail.articleId,
          prixUnitaire: detail.prixUnitaire,
          existantDebut: detail.existantDebut,
          entrees: detail.entreesPourCreation,
          sorties: detail.sortiesPourCreation,
          observation: 'Stock initial reporté depuis un exercice antérieur',
        },
      });
      comptesModifies.add(detail.compteMatiereId);
    }
  }

  for (const compteMatiereId of comptesModifies) {
    const details = await tx.detailCompteMatiere.findMany({
      where: { compteMatiereId },
      select: {
        prixUnitaire: true,
        existantDebut: true,
        entrees: true,
        sorties: true,
      },
    });
    const valeur = details.reduce(
      (total, detail) => ({
        existant: total.existant.plus(decimal(detail.existantDebut).mul(detail.prixUnitaire)),
        entrees: total.entrees.plus(decimal(detail.entrees).mul(detail.prixUnitaire)),
        sorties: total.sorties.plus(decimal(detail.sorties).mul(detail.prixUnitaire)),
      }),
      { existant: decimal(0), entrees: decimal(0), sorties: decimal(0) },
    );
    await tx.compteMatiere.update({
      where: { id: compteMatiereId },
      data: {
        valeurExistanteDebut: valeur.existant,
        valeurEntrees: valeur.entrees,
        valeurSorties: valeur.sorties,
        valeurRestante: valeur.existant.plus(valeur.entrees).minus(valeur.sorties),
      },
    });
  }
}

async function main() {
  console.log(
    APPLY
      ? 'MODE APPLICATION : écritures en base autorisées'
      : 'MODE SIMULATION : aucune écriture en base',
  );

  const { plan } = await chargerPlan(prisma);
  console.log('\nLots (sources et reports) :', plan.lots.length);
  console.log('Affectations FIFO :', plan.affectations.length);
  console.log('Détails d’ouverture à synchroniser :', plan.detailsReportes.length);
  console.log(
    '\nReports :',
    plan.lots.filter((lot) => lot.parentKey !== null).map((lot) => ({
      exercice: lot.annee,
      articleId: lot.articleId,
      parent: lot.parentKey,
      quantite: lot.quantiteInitiale.toString(),
      prixUnitaire: lot.prixUnitaire.toString(),
    })),
  );
  console.log(
    '\nDétails :',
    plan.detailsReportes.map((detail) => ({
      compteMatiereId: detail.compteMatiereId,
      articleId: detail.articleId,
      prixUnitaire: detail.prixUnitaire.toString(),
      existantDebut: detail.existantDebut.toString(),
      action: detail.detailId === null ? 'création' : 'mise à jour',
    })),
  );

  if (!APPLY) {
    console.log('\nSimulation terminée. Aucune donnée modifiée.');
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // Recalculer dans la transaction pour ne pas appliquer un aperçu devenu périmé.
      const planActuel = await chargerPlan(tx);
      await appliquerPlan(tx, planActuel.plan);
    },
    { maxWait: 10000, timeout: 60000 },
  );
  console.log('\nRéconciliation appliquée avec succès.');
}

main()
  .catch((error) => {
    console.error('\nÉchec :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
