import { Prisma, Role } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { MouvementService } from './mouvement.service.js';

describe('MouvementService', () => {
  it('retourne uniquement les lots positifs de l’exercice demandé', async () => {
    const lots = [{
      id: 12,
      exerciceId: 14,
      articleId: 6,
      typeOrigine: 'STOCK_INITIAL',
      lotParentId: null,
      quantiteInitiale: new Prisma.Decimal('7'),
      quantiteRestante: new Prisma.Decimal('7'),
      prixUnitaire: new Prisma.Decimal('400000'),
      dateOrigine: new Date(Date.UTC(2003, 0, 1)),
      article: { designation: 'Table ronde' },
    }];
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 5,
          role: Role.DEPOSITEUR_COMPTABLE,
          soaId: 9,
        }),
      },
      exercice: {
        findUnique: vi.fn().mockResolvedValue({ id: 14, soaId: 9 }),
      },
      lotStock: {
        findMany: vi.fn().mockResolvedValue(lots),
      },
    };
    const service = new MouvementService(prisma as never);

    await expect(service.findLotsDisponiblesSortie(14, 5)).resolves.toEqual(lots);
    expect(prisma.lotStock.findMany).toHaveBeenCalledWith({
      where: { exerciceId: 14 },
      include: { article: { include: { nomenclature: true } } },
      orderBy: [{ dateOrigine: 'asc' }, { id: 'asc' }],
    });
  });

  it('ne double pas le stock initial racine déjà matérialisé par un lot enfant', async () => {
    const root = {
      id: 11,
      exerciceId: 14,
      articleId: 6,
      typeOrigine: 'STOCK_INITIAL',
      lotParentId: null,
      detailCompteMatiereId: 31,
      quantiteInitiale: new Prisma.Decimal('7'),
      quantiteRestante: new Prisma.Decimal('7'),
      prixUnitaire: new Prisma.Decimal('400000'),
      dateOrigine: new Date(Date.UTC(2003, 0, 1)),
      article: { designation: 'Table ronde' },
    };
    const child = {
      ...root,
      id: 12,
      detailCompteMatiereId: null,
      lotParentId: 8,
      quantiteRestante: new Prisma.Decimal('0'),
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({
        id: 5,
        role: Role.DEPOSITEUR_COMPTABLE,
        soaId: 9,
      }) },
      exercice: { findUnique: vi.fn().mockResolvedValue({ id: 14, soaId: 9 }) },
      lotStock: { findMany: vi.fn().mockResolvedValue([root, child]) },
    };

    await expect(new MouvementService(prisma as never).findLotsDisponiblesSortie(14, 5)).resolves.toEqual([]);
  });

  it('crée un lot pour une entrée historique dans la même transaction', async () => {
    const anneeHistorique = new Date().getFullYear() - 1;
    const dateMouvement = new Date(Date.UTC(anneeHistorique, 5, 15));
    const prixUnitaire = new Prisma.Decimal('12.50');
    const quantite = new Prisma.Decimal('4');
    const detail = {
      id: 31,
      prixUnitaire,
      existantDebut: new Prisma.Decimal('2'),
      entrees: new Prisma.Decimal('0'),
      sorties: new Prisma.Decimal('0'),
    };

    const tx = {
      detailCompteMatiere: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([detail])
          .mockResolvedValueOnce([
            { ...detail, entrees: quantite },
          ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
      mouvement: {
        create: vi.fn().mockResolvedValue({ id: 87 }),
      },
      lotStock: {
        create: vi.fn().mockResolvedValue({ id: 102 }),
      },
      compteMatiere: {
        update: vi.fn().mockResolvedValue({ id: 22 }),
      },
    };

    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 5,
          role: Role.DEPOSITEUR_COMPTABLE,
          soaId: 9,
        }),
      },
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue({
          id: 22,
          exerciceId: 14,
          exercice: {
            soaId: 9,
            annee: anneeHistorique,
            dateDebut: new Date(Date.UTC(anneeHistorique, 0, 1)),
            dateFin: new Date(Date.UTC(anneeHistorique, 11, 31, 23, 59, 59)),
          },
        }),
      },
      article: {
        findUnique: vi.fn().mockResolvedValue({ id: 6 }),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    const service = new MouvementService(prisma as never);

    await service.createHistorique(
      22,
      {
        type: 'ENTREE',
        date: dateMouvement.toISOString(),
        articleId: 6,
        prixUnitaire: 12.5,
        quantite: 4,
      },
      5,
    );

    expect(tx.lotStock.create).toHaveBeenCalledWith({
      data: {
        articleId: 6,
        exerciceId: 14,
        typeOrigine: 'ENTREE',
        mouvementEntreeId: 87,
        dateOrigine: dateMouvement,
        quantiteInitiale: quantite,
        quantiteRestante: quantite,
        prixUnitaire,
      },
    });
  });

  it('affecte une sortie historique aux lots disponibles en FIFO', async () => {
    const anneeHistorique = new Date().getFullYear() - 1;
    const dateMouvement = new Date(Date.UTC(anneeHistorique, 5, 15));
    const prixUnitaire = new Prisma.Decimal('12.50');
    const detail = {
      id: 31,
      prixUnitaire,
      existantDebut: new Prisma.Decimal('8'),
      entrees: new Prisma.Decimal('0'),
      sorties: new Prisma.Decimal('0'),
    };
    const lots = [
      {
        id: 40,
        quantiteRestante: new Prisma.Decimal('3'),
        dateOrigine: new Date(Date.UTC(anneeHistorique, 1, 1)),
      },
      {
        id: 41,
        quantiteRestante: new Prisma.Decimal('5'),
        dateOrigine: new Date(Date.UTC(anneeHistorique, 2, 1)),
      },
    ];
    const tx = {
      detailCompteMatiere: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([detail])
          .mockResolvedValueOnce([
            { ...detail, sorties: new Prisma.Decimal('6') },
          ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
      lotStock: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(lots),
        updateMany: vi
          .fn()
          .mockResolvedValue({ count: 1 }),
        create: vi.fn(),
      },
      affectationSortie: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      mouvement: {
        create: vi.fn().mockResolvedValue({ id: 88 }),
      },
      compteMatiere: {
        update: vi.fn().mockResolvedValue({ id: 22 }),
      },
    };
    const prisma = makeHistoriquePrisma(anneeHistorique, tx);
    const service = new MouvementService(prisma as never);

    await service.createHistorique(
      22,
      {
        type: 'SORTIE',
        date: dateMouvement.toISOString(),
        articleId: 6,
        prixUnitaire: 12.5,
        quantite: 6,
      },
      5,
    );

    expect(tx.lotStock.findMany).toHaveBeenCalledWith({
      where: {
        articleId: 6,
        exerciceId: 14,
        prixUnitaire,
        dateOrigine: { lte: dateMouvement },
        quantiteRestante: { gt: 0 },
      },
      orderBy: [{ dateOrigine: 'asc' }, { id: 'asc' }],
    });
    expect(tx.lotStock.updateMany.mock.calls).toEqual([
      [
        {
          where: {
            id: 40,
            articleId: 6,
            exerciceId: 14,
            prixUnitaire,
            dateOrigine: { lte: dateMouvement },
            quantiteRestante: { gte: new Prisma.Decimal('3') },
          },
          data: { quantiteRestante: { decrement: new Prisma.Decimal('3') } },
        },
      ],
      [
        {
          where: {
            id: 41,
            articleId: 6,
            exerciceId: 14,
            prixUnitaire,
            dateOrigine: { lte: dateMouvement },
            quantiteRestante: { gte: new Prisma.Decimal('3') },
          },
          data: { quantiteRestante: { decrement: new Prisma.Decimal('3') } },
        },
      ],
    ]);
    expect(tx.affectationSortie.create.mock.calls).toEqual([
      [
        {
          data: {
            mouvementSortieId: 88,
            lotStockId: 40,
            quantite: new Prisma.Decimal('3'),
          },
        },
      ],
      [
        {
          data: {
            mouvementSortieId: 88,
            lotStockId: 41,
            quantite: new Prisma.Decimal('3'),
          },
        },
      ],
    ]);
    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: { sorties: { increment: new Prisma.Decimal('6') } },
    });
  });

  it('refuse une sortie historique sans assez de lots éligibles', async () => {
    const anneeHistorique = new Date().getFullYear() - 1;
    const detail = {
      id: 31,
      prixUnitaire: new Prisma.Decimal('12.50'),
      existantDebut: new Prisma.Decimal('8'),
      entrees: new Prisma.Decimal('0'),
      sorties: new Prisma.Decimal('0'),
    };
    const tx = {
      detailCompteMatiere: {
        findMany: vi.fn().mockResolvedValue([detail]),
        update: vi.fn(),
      },
      lotStock: {
        findMany: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { id: 40, quantiteRestante: new Prisma.Decimal('2') },
          ]),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
      affectationSortie: { create: vi.fn() },
      mouvement: { create: vi.fn() },
      compteMatiere: { update: vi.fn() },
    };
    const service = new MouvementService(
      makeHistoriquePrisma(anneeHistorique, tx) as never,
    );

    await expect(
      service.createHistorique(
        22,
        {
          type: 'SORTIE',
          date: new Date(Date.UTC(anneeHistorique, 5, 15)).toISOString(),
          articleId: 6,
          prixUnitaire: 12.5,
          quantite: 6,
        },
        5,
      ),
    ).rejects.toThrow('Stock insuffisant dans les lots disponibles');

    expect(tx.mouvement.create).not.toHaveBeenCalled();
    expect(tx.detailCompteMatiere.update).not.toHaveBeenCalled();
    expect(tx.lotStock.updateMany).not.toHaveBeenCalled();
  });

  it('permet en 2003 une sortie du lot STOCK_INITIAL root de 7 unités reporté depuis 2000', async () => {
    const dateMouvement = new Date(Date.UTC(2003, 5, 15));
    const prixUnitaire = new Prisma.Decimal('400000');
    const quantiteReportee = new Prisma.Decimal('7');
    const resteApresSorties2003 = new Prisma.Decimal('5');
    const detailCree = {
      id: 32,
      prixUnitaire,
      existantDebut: quantiteReportee,
      entrees: new Prisma.Decimal('0'),
      sorties: new Prisma.Decimal('0'),
    };
    // Chaîne de transfert 2000 -> 2001 -> 2002 -> 2003.
    const lot2003 = {
      id: 23,
      typeOrigine: 'STOCK_INITIAL',
      lotParentId: null,
      quantiteInitiale: quantiteReportee,
      quantiteRestante: resteApresSorties2003,
      dateOrigine: new Date(Date.UTC(2003, 0, 1)),
    };
    const tx = {
      detailCompteMatiere: {
        findMany: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { ...detailCree, sorties: new Prisma.Decimal('6') },
          ]),
        create: vi.fn().mockResolvedValue(detailCree),
        update: vi.fn().mockResolvedValue(undefined),
      },
      mouvement: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 89 }),
      },
      lotStock: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ quantiteInitiale: quantiteReportee }])
          .mockResolvedValueOnce([lot2003]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
      },
      affectationSortie: { create: vi.fn().mockResolvedValue(undefined) },
      compteMatiere: { update: vi.fn().mockResolvedValue({ id: 22 }) },
    };
    const service = new MouvementService(makeHistoriquePrisma(2003, tx) as never);

    await service.createHistorique(
      22,
      {
        type: 'SORTIE',
        date: dateMouvement.toISOString(),
        articleId: 6,
        prixUnitaire: 400000,
        quantite: 2,
      },
      5,
    );

    expect(tx.detailCompteMatiere.create).toHaveBeenCalledWith({
      data: {
        compteMatiereId: 22,
        articleId: 6,
        prixUnitaire,
        existantDebut: quantiteReportee,
        entrees: new Prisma.Decimal('0'),
        sorties: new Prisma.Decimal('0'),
        observation: 'Stock initial reporté depuis un exercice antérieur',
      },
    });
    expect(tx.lotStock.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        articleId: 6,
        exerciceId: 14,
        prixUnitaire,
        typeOrigine: 'STOCK_INITIAL',
        dateOrigine: { lte: dateMouvement },
        quantiteInitiale: { gt: 0 },
      },
      select: { quantiteInitiale: true },
    });
    expect(tx.lotStock.create).not.toHaveBeenCalled();
    expect(tx.lotStock.updateMany).toHaveBeenCalledWith({
      where: {
        id: 23,
        articleId: 6,
        exerciceId: 14,
        prixUnitaire,
        dateOrigine: { lte: dateMouvement },
        quantiteRestante: { gte: new Prisma.Decimal('2') },
      },
      data: { quantiteRestante: { decrement: new Prisma.Decimal('2') } },
    });
    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 32 },
      data: { sorties: { increment: new Prisma.Decimal('2') } },
    });
    expect(tx.affectationSortie.create).toHaveBeenCalledWith({
      data: {
        mouvementSortieId: 89,
        lotStockId: 23,
        quantite: new Prisma.Decimal('2'),
      },
    });
  });

  it('refuse une sortie en 2003 quand le stock reporté depuis 2000 est épuisé', async () => {
    const prixUnitaire = new Prisma.Decimal('12.50');
    const dateMouvement = new Date(Date.UTC(2003, 5, 15));
    const tx = {
      detailCompteMatiere: {
        findMany: vi.fn().mockResolvedValueOnce([]),
        create: vi.fn().mockResolvedValue({
          id: 32,
          prixUnitaire,
          existantDebut: new Prisma.Decimal('6'),
          entrees: new Prisma.Decimal('0'),
          sorties: new Prisma.Decimal('6'),
        }),
        update: vi.fn(),
      },
      mouvement: {
        findMany: vi.fn().mockResolvedValue([
          { type: 'SORTIE', quantite: new Prisma.Decimal('6') },
        ]),
        create: vi.fn(),
      },
      lotStock: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ quantiteInitiale: new Prisma.Decimal('6') }])
          .mockResolvedValueOnce([]),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
      affectationSortie: { create: vi.fn() },
      compteMatiere: { update: vi.fn() },
    };
    const service = new MouvementService(makeHistoriquePrisma(2003, tx) as never);

    await expect(
      service.createHistorique(
        22,
        {
          type: 'SORTIE',
          date: dateMouvement.toISOString(),
          articleId: 6,
          prixUnitaire: 12.5,
          quantite: 1,
        },
        5,
      ),
    ).rejects.toThrow('Stock insuffisant dans les lots disponibles');

    expect(tx.mouvement.create).not.toHaveBeenCalled();
    expect(tx.lotStock.updateMany).not.toHaveBeenCalled();
    expect(tx.affectationSortie.create).not.toHaveBeenCalled();
  });
});

describe('MouvementService.reporterStockDepuisExercicePrecedent', () => {
  function makeChronologie(previous: object[]) {
    const tx = {
      exercice: {
        findUnique: vi.fn().mockResolvedValue({ id: 30, soaId: 9, annee: 2025 }),
        findMany: vi.fn().mockResolvedValue(previous),
      },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({
        id: 5,
        role: Role.DEPOSITEUR_COMPTABLE,
        soaId: 9,
      }) },
    };
    const service = new MouvementService(prisma as never);
    const reportSpy = vi
      .spyOn(service, 'reporterStockVersExerciceSuivant')
      .mockResolvedValue({ idempotent: false } as never);
    return { service, tx, reportSpy };
  }

  it('matérialise les reports successifs depuis le premier exercice comptable', async () => {
    const previous = {
      id: 21,
      annee: 2020,
      compteMatiere: { id: 19 },
      _count: { mouvements: 0, lotsStock: 0 },
    };
    const { service, tx, reportSpy } = makeChronologie([
      { id: 19, annee: 2018, compteMatiere: { id: 18 }, _count: { mouvements: 0, lotsStock: 0 } },
      previous,
    ]);

    await expect(service.reporterStockDepuisExercicePrecedent(30, 5, tx as never)).resolves.toMatchObject({
      reporte: true,
    });
    expect(tx.exercice.findMany).toHaveBeenCalledWith({
      where: { soaId: 9, annee: { lt: 2025 } },
      orderBy: [{ annee: 'asc' }, { id: 'asc' }],
      include: {
        compteMatiere: { select: { id: true } },
        _count: { select: { mouvements: true, lotsStock: true } },
      },
    });
    expect(reportSpy.mock.calls).toEqual([
      [19, 5, 21, tx],
      [21, 5, 30, tx],
    ]);
  });

  it('inclut les exercices intermédiaires sans Compte Matière dans la chaîne de report', async () => {
    const { service, tx, reportSpy } = makeChronologie([
      { id: 21, annee: 2020, compteMatiere: { id: 19 }, _count: { mouvements: 0, lotsStock: 0 } },
      { id: 29, annee: 2023, compteMatiere: null, _count: { mouvements: 0, lotsStock: 0 } },
    ]);

    await expect(service.reporterStockDepuisExercicePrecedent(30, 5, tx as never)).resolves.toMatchObject({ reporte: true });
    expect(reportSpy.mock.calls).toEqual([
      [21, 5, 29, tx],
      [29, 5, 30, tx],
    ]);
  });

  it('ne matérialise rien quand aucun exercice antérieur n’existe', async () => {
    const { service, tx, reportSpy } = makeChronologie([]);

    await expect(service.reporterStockDepuisExercicePrecedent(30, 5, tx as never)).resolves.toEqual({
      reporte: false,
      raison: 'AUCUN_EXERCICE_PRECEDENT',
    });
    expect(reportSpy).not.toHaveBeenCalled();
  });
});

function makeHistoriquePrisma(anneeHistorique: number, tx: object) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 5,
        role: Role.DEPOSITEUR_COMPTABLE,
        soaId: 9,
      }),
    },
    compteMatiere: {
      findUnique: vi.fn().mockResolvedValue({
        id: 22,
        exerciceId: 14,
        exercice: {
          soaId: 9,
          annee: anneeHistorique,
          dateDebut: new Date(Date.UTC(anneeHistorique, 0, 1)),
          dateFin: new Date(Date.UTC(anneeHistorique, 11, 31, 23, 59, 59)),
        },
      }),
    },
    article: {
      findUnique: vi.fn().mockResolvedValue({ id: 6 }),
    },
    $transaction: vi.fn((callback: (client: object) => unknown) =>
      callback(tx),
    ),
  };
}
