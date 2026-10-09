import { Prisma, Role } from '@prisma/client';
import { MouvementService } from './mouvement.service.js';

const prixUnitaire = new Prisma.Decimal('400000');
const dateDebutCible = new Date(Date.UTC(2003, 0, 1));

function makeReportService(options?: {
  targetExerciseId?: number;
  targetYear?: number;
  targetDateDebut?: Date;
  targetHasCompte?: boolean;
  sourceExerciseId?: number;
  sourceYear?: number;
  sourceDateDebut?: Date;
  sourceLots?: object[];
  sourceDetails?: object[];
  targetLots?: object[];
  targetDetails?: object[];
  targetMovements?: object[];
  targetAffectations?: object[];
  sourceMovements?: object[];
  sourceAffectations?: object[];
  intermediateExercises?: Array<{ id: number; annee: number }>;
  intermediateLots?: object[];
  intermediateMovements?: object[];
  intermediateAffectations?: object[];
}) {
  const sourceExerciseId = options?.sourceExerciseId ?? 14;
  const sourceYear = options?.sourceYear ?? 2000;
  const sourceDateDebut = options?.sourceDateDebut ?? new Date(Date.UTC(sourceYear, 0, 1));
  const targetExerciseId = options?.targetExerciseId ?? 13;
  const targetYear = options?.targetYear ?? 2003;
  const targetDateDebut = options?.targetDateDebut ?? dateDebutCible;
  const sourceLots = options?.sourceLots ?? [{
    id: 12,
    articleId: 4,
    exerciceId: sourceExerciseId,
    typeOrigine: 'ENTREE',
    mouvementEntreeId: 8,
    detailCompteMatiereId: null,
    lotParentId: null,
    prixUnitaire,
    quantiteInitiale: new Prisma.Decimal('7'),
    quantiteRestante: new Prisma.Decimal('7'),
    dateOrigine: new Date(Date.UTC(2000, 0, 1)),
  }];
  const sourceDetails = options?.sourceDetails ?? [];
  const targetLots = options?.targetLots ?? [];
  const targetDetails = options?.targetDetails ?? [{
    id: 31,
    articleId: 4,
    prixUnitaire,
    existantDebut: new Prisma.Decimal('0'),
    entrees: new Prisma.Decimal('0'),
    sorties: new Prisma.Decimal('0'),
  }];
  const targetMovements = options?.targetMovements ?? [];
  const sourceMovements = options?.sourceMovements ?? [];
  const intermediateExercises = options?.intermediateExercises ?? [];
  const intermediateLots = options?.intermediateLots ?? [];
  const intermediateMovements = options?.intermediateMovements ?? [];
  const intermediateAffectations = options?.intermediateAffectations ?? [];
  const affectations = [
    ...(options?.sourceAffectations ?? []),
    ...(options?.targetAffectations ?? []),
    ...intermediateAffectations,
  ] as Array<Record<string, unknown>>;
  const materializedLots = new Map<number, Array<Record<string, unknown>>>([
    [sourceExerciseId, [...sourceLots] as Array<Record<string, unknown>>],
    [targetExerciseId, [...targetLots] as Array<Record<string, unknown>>],
  ]);
  let nextLotId = 90;

  const tx = {
    exercice: {
      findUnique: vi.fn().mockImplementation(async ({ where, include }: {
        where: { id: number };
        include?: unknown;
      }) => {
        if (where.id === sourceExerciseId) return {
          id: sourceExerciseId,
          annee: sourceYear,
          soaId: 2,
          dateDebut: sourceDateDebut,
          ...(include ? { lotsStock: materializedLots.get(sourceExerciseId) ?? [], compteMatiere: { details: sourceDetails } } : {}),
        };
        if (where.id === targetExerciseId) return {
          id: targetExerciseId,
          annee: targetYear,
          soaId: 2,
          dateDebut: targetDateDebut,
          lotsStock: targetLots,
          compteMatiere: options?.targetHasCompte === false
            ? null
            : { id: 6, details: targetDetails },
        };
        return null;
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: targetExerciseId,
        annee: targetYear,
        soaId: 2,
        dateDebut: targetDateDebut,
        lotsStock: targetLots,
        compteMatiere: options?.targetHasCompte === false
          ? null
          : { id: 6, details: targetDetails },
      }),
      findMany: vi.fn().mockResolvedValue(intermediateExercises),
    },
    lotStock: {
      findMany: vi.fn().mockImplementation(async ({ where }: { where: { exerciceId: number | { in: number[] }; typeOrigine?: string } }) =>
        typeof where.exerciceId === 'number'
          ? materializedLots.get(where.exerciceId) ?? intermediateLots.filter(
            (lot) => (lot as { exerciceId: number }).exerciceId === where.exerciceId,
          )
          : where.exerciceId.in.some((id) => intermediateExercises.some((exercise) => exercise.id === id))
            ? intermediateLots.filter((lot) => where.typeOrigine === undefined || (lot as { typeOrigine: string }).typeOrigine === where.typeOrigine)
            : []),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const lot = { ...data, id: nextLotId++ };
        const current = materializedLots.get(data.exerciceId as number) ?? [];
        if (intermediateExercises.some((exercise) => exercise.id === data.exerciceId)) {
          intermediateLots.push(lot);
        } else {
          current.push(lot);
          materializedLots.set(data.exerciceId as number, current);
        }
        return lot;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => {
        for (const lots of materializedLots.values()) {
          const lot = lots.find((item) => item.id === where.id);
          if (lot) Object.assign(lot, data);
        }
        const intermediateLot = intermediateLots.find(
          (item) => (item as { id: number }).id === where.id,
        );
        if (intermediateLot) Object.assign(intermediateLot, data);
      }),
    },
    detailCompteMatiere: {
      create: vi.fn().mockResolvedValue({ id: 32 }),
      update: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn().mockResolvedValue(
        targetDetails.map((detail) => ({
          ...detail,
          existantDebut: new Prisma.Decimal('7'),
        })),
      ),
    },
    mouvement: {
      findMany: vi.fn().mockImplementation(async ({ where }: { where: { exerciceId: number | { in: number[] } } }) =>
        typeof where.exerciceId === 'number'
          ? where.exerciceId === sourceExerciseId
            ? sourceMovements
            : intermediateExercises.some((exercise) => exercise.id === where.exerciceId)
              ? intermediateMovements.filter(
                (movement) => (movement as { exerciceId: number }).exerciceId === where.exerciceId,
              )
              : targetMovements
          : intermediateMovements),
      create: vi.fn(),
    },
    affectationSortie: {
      findMany: vi.fn().mockImplementation(async ({ where }: {
        where: { mouvementSortieId: { in: number[] } };
      }) => affectations.filter((item) => where.mouvementSortieId.in.includes(item.mouvementSortieId as number))),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        affectations.push(data);
        return { id: affectations.length, ...data };
      }),
    },
    compteMatiere: { update: vi.fn().mockResolvedValue({ id: 6 }) },
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 5,
        role: Role.DEPOSITEUR_COMPTABLE,
        soaId: 2,
      }),
    },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  return { service: new MouvementService(prisma as never), prisma, tx };
}

describe('MouvementService.reporterStockVersExerciceSuivant', () => {
  it('matérialise 7 unités de 2000 dans le Compte Matière et les lots de 2003', async () => {
    const { service, tx } = makeReportService();

    const result = await service.reporterStockVersExerciceSuivant(14, 5);

    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: {
        articleId: 4,
        exerciceId: 13,
        typeOrigine: 'STOCK_INITIAL',
        dateOrigine: dateDebutCible,
        quantiteInitiale: new Prisma.Decimal('7'),
        quantiteRestante: new Prisma.Decimal('7'),
        prixUnitaire,
        lotParentId: 12,
      },
    });
    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: {
        existantDebut: new Prisma.Decimal('7'),
        entrees: new Prisma.Decimal('0'),
        sorties: new Prisma.Decimal('0'),
      },
    });
    expect(tx.mouvement.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      exerciceSource: { id: 14, annee: 2000 },
      exerciceCible: { id: 13, annee: 2003 },
      lotsCrees: 1,
      detailsMisAJour: 1,
      idempotent: false,
    });
  });

  it('matérialise une ouverture comptable source sans lot avant le report', async () => {
    const { service, tx } = makeReportService({
      sourceLots: [],
      sourceDetails: [{
        id: 33,
        articleId: 4,
        prixUnitaire,
        existantDebut: new Prisma.Decimal('4'),
        entrees: new Prisma.Decimal('0'),
        sorties: new Prisma.Decimal('0'),
      }],
    });

    await service.reporterStockVersExerciceSuivant(14, 5, 13);

    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        articleId: 4,
        exerciceId: 14,
        typeOrigine: 'STOCK_INITIAL',
        detailCompteMatiereId: 33,
        quantiteInitiale: new Prisma.Decimal('4'),
        quantiteRestante: new Prisma.Decimal('4'),
      }),
    });
    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        articleId: 4,
        exerciceId: 13,
        typeOrigine: 'STOCK_INITIAL',
        quantiteInitiale: new Prisma.Decimal('4'),
        quantiteRestante: new Prisma.Decimal('4'),
      }),
    });
    expect(tx.mouvement.create).not.toHaveBeenCalled();
  });

  it('matérialise le lot reporté dans un exercice intermédiaire sans Compte Matière', async () => {
    const { service, tx } = makeReportService({ targetHasCompte: false });

    const result = await service.reporterStockVersExerciceSuivant(14, 5, 13);

    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        exerciceId: 13,
        typeOrigine: 'STOCK_INITIAL',
        quantiteInitiale: new Prisma.Decimal('7'),
        quantiteRestante: new Prisma.Decimal('7'),
      }),
    });
    expect(tx.detailCompteMatiere.create).not.toHaveBeenCalled();
    expect(result.quantitesReportees).toEqual([{
      articleId: 4,
      prixUnitaire: '400000',
      quantite: '7',
    }]);
  });

  it('est idempotent et ne double pas le lot parent/enfant déjà consommé partiellement', async () => {
    const childLot = {
      id: 90,
      articleId: 4,
      exerciceId: 13,
      typeOrigine: 'STOCK_INITIAL',
      lotParentId: 12,
      prixUnitaire,
      quantiteInitiale: new Prisma.Decimal('7'),
      quantiteRestante: new Prisma.Decimal('5'),
      dateOrigine: new Date(Date.UTC(2002, 0, 1)),
    };
    const targetDetail = {
      id: 31,
      articleId: 4,
      prixUnitaire,
      existantDebut: new Prisma.Decimal('7'),
      entrees: new Prisma.Decimal('0'),
      sorties: new Prisma.Decimal('2'),
    };
    const { service, tx } = makeReportService({
      targetLots: [childLot],
      targetDetails: [targetDetail],
      targetMovements: [{
        id: 44,
        type: 'SORTIE',
        date: new Date(Date.UTC(2003, 5, 1)),
        articleId: 4,
        prixUnitaire,
        quantite: new Prisma.Decimal('2'),
      }],
      targetAffectations: [{
        id: 1,
        mouvementSortieId: 44,
        lotStockId: 90,
        quantite: new Prisma.Decimal('2'),
        createdAt: new Date(Date.UTC(2003, 5, 1)),
      }],
    });

    const result = await service.reporterStockVersExerciceSuivant(14, 5);

    expect(tx.lotStock.create).not.toHaveBeenCalled();
    expect(tx.detailCompteMatiere.create).not.toHaveBeenCalled();
    expect(tx.detailCompteMatiere.update).not.toHaveBeenCalled();
    expect(tx.compteMatiere.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ lotsCrees: 0, idempotent: true });
  });

  it('ne recompte pas le lot racine du détail lorsque le même stock existe déjà en lot enfant', async () => {
    const child = {
      id: 22,
      articleId: 4,
      exerciceId: 14,
      typeOrigine: 'STOCK_INITIAL',
      mouvementEntreeId: null,
      detailCompteMatiereId: null,
      lotParentId: 20,
      prixUnitaire,
      quantiteInitiale: new Prisma.Decimal('7'),
      quantiteRestante: new Prisma.Decimal('7'),
    };
    const rootOpening = {
      id: 23,
      articleId: 4,
      exerciceId: 14,
      typeOrigine: 'STOCK_INITIAL',
      mouvementEntreeId: null,
      detailCompteMatiereId: 30,
      lotParentId: null,
      prixUnitaire,
      quantiteInitiale: new Prisma.Decimal('7'),
      quantiteRestante: new Prisma.Decimal('7'),
    };
    const { service, tx } = makeReportService({
      sourceLots: [child, rootOpening],
      sourceDetails: [{
        id: 30,
        articleId: 4,
        prixUnitaire,
        existantDebut: new Prisma.Decimal('7'),
      }],
    });
    vi.mocked(tx.exercice.findUnique).mockResolvedValue({
      id: 14,
      annee: 2002,
      soaId: 2,
      lotsStock: [child, rootOpening],
      compteMatiere: { details: [{
        id: 30,
        articleId: 4,
        prixUnitaire,
        existantDebut: new Prisma.Decimal('7'),
      }] },
    } as never);

    await service.reporterStockVersExerciceSuivant(14, 5);

    expect(tx.lotStock.create).toHaveBeenCalledTimes(1);
    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantiteInitiale: new Prisma.Decimal('7'),
        quantiteRestante: new Prisma.Decimal('7'),
        lotParentId: 22,
      }),
    });
  });

  it('ne reporte que 5 unités après une sortie intermédiaire de 2 unités', async () => {
    const child = {
      id: 22,
      articleId: 4,
      exerciceId: 14,
      typeOrigine: 'STOCK_INITIAL',
      mouvementEntreeId: null,
      detailCompteMatiereId: null,
      lotParentId: 20,
      prixUnitaire,
      quantiteInitiale: new Prisma.Decimal('7'),
      quantiteRestante: new Prisma.Decimal('5'),
      dateOrigine: new Date(Date.UTC(2002, 0, 1)),
    };
    const sourceDetail = {
      id: 30,
      articleId: 4,
      prixUnitaire,
      existantDebut: new Prisma.Decimal('7'),
      entrees: new Prisma.Decimal('0'),
      sorties: new Prisma.Decimal('2'),
    };
    const { service, tx } = makeReportService({
      sourceLots: [child],
      sourceDetails: [sourceDetail],
      sourceMovements: [{
        id: 60,
        type: 'SORTIE',
        date: new Date(Date.UTC(2002, 5, 1)),
        articleId: 4,
        prixUnitaire,
        quantite: new Prisma.Decimal('2'),
      }],
    });
    vi.mocked(tx.exercice.findUnique).mockResolvedValue({
      id: 14,
      annee: 2002,
      soaId: 2,
      lotsStock: [child],
      compteMatiere: { details: [sourceDetail] },
    } as never);
    vi.mocked(tx.exercice.findFirst).mockResolvedValue({
      id: 13,
      annee: 2003,
      soaId: 2,
      dateDebut: dateDebutCible,
      lotsStock: [],
      compteMatiere: { id: 6, details: [{
        id: 31,
        articleId: 4,
        prixUnitaire,
        existantDebut: new Prisma.Decimal('0'),
        entrees: new Prisma.Decimal('0'),
        sorties: new Prisma.Decimal('0'),
      }] },
    } as never);
    await service.reporterStockVersExerciceSuivant(14, 5);

    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantiteInitiale: new Prisma.Decimal('5'),
        quantiteRestante: new Prisma.Decimal('5'),
        lotParentId: 22,
      }),
    });
  });

  it('affecte en FIFO une sortie historique existante du nouvel exercice', async () => {
    const sortie = {
      id: 45,
      type: 'SORTIE',
      date: new Date(Date.UTC(2003, 5, 1)),
      articleId: 4,
      prixUnitaire,
      quantite: new Prisma.Decimal('2'),
    };
    const { service, tx } = makeReportService({ targetMovements: [sortie] });

    const result = await service.reporterStockVersExerciceSuivant(14, 5);

    expect(tx.affectationSortie.create).toHaveBeenCalledWith({
      data: {
        mouvementSortieId: 45,
        lotStockId: 90,
        quantite: new Prisma.Decimal('2'),
      },
    });
    expect(tx.lotStock.update).toHaveBeenCalledWith({
      where: { id: 90 },
      data: { quantiteRestante: new Prisma.Decimal('5') },
    });
    expect(result).toMatchObject({ lotsCrees: 1, sortiesFIFOCompletes: 1 });
  });

  it('reporte le solde après une sortie de 0,79 et ne déduit pas deux fois les affectations existantes', async () => {
    const sortieSource = {
      id: 55,
      type: 'SORTIE',
      date: new Date(Date.UTC(2000, 5, 1)),
      articleId: 4,
      prixUnitaire,
      quantite: new Prisma.Decimal('0.79'),
    };
    const { service, tx } = makeReportService({
      sourceMovements: [sortieSource],
    });

    await service.reporterStockVersExerciceSuivant(14, 5);

    expect(tx.affectationSortie.create).toHaveBeenCalledWith({
      data: {
        mouvementSortieId: 55,
        lotStockId: 12,
        quantite: new Prisma.Decimal('0.79'),
      },
    });
    expect(tx.lotStock.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { quantiteRestante: new Prisma.Decimal('6.21') },
    });
    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        exerciceId: 13,
        quantiteInitiale: new Prisma.Decimal('6.21'),
        quantiteRestante: new Prisma.Decimal('6.21'),
      }),
    });
  });

  it('rejoue les sorties des exercices intermédiaires et reporte 6,21 de 2000 vers 2003', async () => {
    const { service, tx } = makeReportService({
      intermediateExercises: [
        { id: 15, annee: 2001 },
        { id: 16, annee: 2002 },
      ],
      // Le lot enfant matérialisé en 2001 ne doit pas s'ajouter au lot 12.
      intermediateLots: [{
        id: 15,
        articleId: 4,
        exerciceId: 15,
        typeOrigine: 'STOCK_INITIAL',
        mouvementEntreeId: null,
        detailCompteMatiereId: null,
        lotParentId: 12,
        dateOrigine: new Date(Date.UTC(2001, 0, 1)),
        quantiteInitiale: new Prisma.Decimal('7'),
        // Ancienne valeur non recalculée: le report doit persister la sortie.
        quantiteRestante: new Prisma.Decimal('7'),
        prixUnitaire,
      }],
      intermediateMovements: [{
        id: 18,
        exerciceId: 15,
        type: 'SORTIE',
        date: new Date(Date.UTC(2001, 5, 1)),
        articleId: 4,
        quantite: new Prisma.Decimal('0.79'),
        prixUnitaire,
      }],
    });

    const result = await service.reporterStockVersExerciceSuivant(14, 5, 13);

    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: {
        articleId: 4,
        exerciceId: 13,
        typeOrigine: 'STOCK_INITIAL',
        dateOrigine: dateDebutCible,
        quantiteInitiale: new Prisma.Decimal('6.21'),
        quantiteRestante: new Prisma.Decimal('6.21'),
        prixUnitaire,
        lotParentId: 12,
      },
    });
    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: {
        existantDebut: new Prisma.Decimal('6.21'),
        entrees: new Prisma.Decimal('0'),
        sorties: new Prisma.Decimal('0'),
      },
    });
    expect(result.quantitesReportees).toEqual([{
      articleId: 4,
      prixUnitaire: '400000',
      quantite: '6.21',
    }]);
    expect(tx.affectationSortie.create).toHaveBeenCalledWith({
      data: {
        mouvementSortieId: 18,
        lotStockId: 15,
        quantite: new Prisma.Decimal('0.79'),
      },
    });
    expect(tx.lotStock.update).toHaveBeenCalledWith({
      where: { id: 15 },
      data: { quantiteRestante: new Prisma.Decimal('6.21') },
    });
  });

  it('préserve une affectation intermédiaire existante sans redéduire le lot', async () => {
    const sortie = {
      id: 18,
      exerciceId: 15,
      type: 'SORTIE',
      date: new Date(Date.UTC(2001, 5, 1)),
      articleId: 4,
      quantite: new Prisma.Decimal('0.79'),
      prixUnitaire,
    };
    const { service, tx } = makeReportService({
      intermediateExercises: [{ id: 15, annee: 2001 }],
      intermediateLots: [{
        id: 15,
        articleId: 4,
        exerciceId: 15,
        typeOrigine: 'STOCK_INITIAL',
        mouvementEntreeId: null,
        detailCompteMatiereId: null,
        lotParentId: 12,
        dateOrigine: new Date(Date.UTC(2001, 0, 1)),
        quantiteInitiale: new Prisma.Decimal('7'),
        quantiteRestante: new Prisma.Decimal('6.21'),
        prixUnitaire,
      }],
      intermediateMovements: [sortie],
      intermediateAffectations: [{
        id: 91,
        mouvementSortieId: 18,
        lotStockId: 15,
        quantite: new Prisma.Decimal('0.79'),
      }],
    });

    const result = await service.reporterStockVersExerciceSuivant(14, 5, 13);

    expect(tx.affectationSortie.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ mouvementSortieId: 18 }),
    });
    expect(tx.lotStock.update).not.toHaveBeenCalledWith({
      where: { id: 15 },
      data: { quantiteRestante: new Prisma.Decimal('6.21') },
    });
    expect(result.quantitesReportees).toEqual([{
      articleId: 4,
      prixUnitaire: '400000',
      quantite: '6.21',
    }]);
  });

  it('reporte 6,21 de 2003 vers 2023 après la correction du premier report', async () => {
    const lot2003 = {
      id: 13,
      articleId: 4,
      exerciceId: 14,
      typeOrigine: 'STOCK_INITIAL',
      mouvementEntreeId: null,
      detailCompteMatiereId: null,
      lotParentId: 12,
      dateOrigine: new Date(Date.UTC(2003, 0, 1)),
      quantiteInitiale: new Prisma.Decimal('6.21'),
      quantiteRestante: new Prisma.Decimal('6.21'),
      prixUnitaire,
    };
    const { service, tx } = makeReportService({
      sourceExerciseId: 14,
      sourceYear: 2003,
      sourceLots: [lot2003],
      targetExerciseId: 23,
      targetYear: 2023,
      targetDateDebut: new Date(Date.UTC(2023, 0, 1)),
      targetDetails: [{
        id: 31,
        articleId: 4,
        prixUnitaire,
        existantDebut: new Prisma.Decimal('0'),
        entrees: new Prisma.Decimal('0'),
        sorties: new Prisma.Decimal('0'),
      }],
    });

    await service.reporterStockVersExerciceSuivant(14, 5, 23);

    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        articleId: 4,
        exerciceId: 23,
        typeOrigine: 'STOCK_INITIAL',
        lotParentId: 13,
        quantiteInitiale: new Prisma.Decimal('6.21'),
        quantiteRestante: new Prisma.Decimal('6.21'),
      }),
    });
  });

  it('ne déduit pas une seconde fois une affectation FIFO déjà enregistrée', async () => {
    const sortieSource = {
      id: 56,
      type: 'SORTIE',
      date: new Date(Date.UTC(2000, 5, 1)),
      articleId: 4,
      prixUnitaire,
      quantite: new Prisma.Decimal('0.79'),
    };
    const { service, tx } = makeReportService({
      sourceLots: [{
        id: 12,
        articleId: 4,
        exerciceId: 14,
        typeOrigine: 'ENTREE',
        mouvementEntreeId: 8,
        detailCompteMatiereId: null,
        lotParentId: null,
        prixUnitaire,
        quantiteInitiale: new Prisma.Decimal('7'),
        quantiteRestante: new Prisma.Decimal('6.21'),
        dateOrigine: new Date(Date.UTC(2000, 0, 1)),
      }],
      sourceMovements: [sortieSource],
      sourceAffectations: [{
        id: 1,
        mouvementSortieId: 56,
        lotStockId: 12,
        quantite: new Prisma.Decimal('0.79'),
        createdAt: new Date(Date.UTC(2000, 5, 1)),
      }],
    });

    await service.reporterStockVersExerciceSuivant(14, 5);

    expect(tx.affectationSortie.create).not.toHaveBeenCalled();
    expect(tx.lotStock.update).not.toHaveBeenCalled();
    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        exerciceId: 13,
        quantiteInitiale: new Prisma.Decimal('6.21'),
        quantiteRestante: new Prisma.Decimal('6.21'),
      }),
    });
  });
});
