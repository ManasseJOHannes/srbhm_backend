import { Prisma } from '@prisma/client';
import {
  planifierReportStock,
  type StockTransferExercise,
} from './stock-transfer-planner.js';

function exercise(
  id: number,
  year: number,
  movements: StockTransferExercise['mouvements'] = [],
  opening: string | null = null,
): StockTransferExercise {
  return {
    id,
    annee: year,
    soaId: 9,
    compteMatiereId: id + 100,
    details: opening === null
      ? []
      : [{
          id: id + 1000,
          articleId: 7,
          prixUnitaire: new Prisma.Decimal('400000'),
          existantDebut: new Prisma.Decimal(opening),
          entrees: new Prisma.Decimal('0'),
          sorties: new Prisma.Decimal('0'),
        }],
    mouvements: movements,
  };
}

function movement(
  id: number,
  year: number,
  type: 'ENTREE' | 'SORTIE',
  quantity: string,
): StockTransferExercise['mouvements'][number] {
  return {
    id,
    articleId: 7,
    designation: 'Table ronde',
    prixUnitaire: new Prisma.Decimal('400000'),
    quantite: new Prisma.Decimal(quantity),
    date: new Date(Date.UTC(year, type === 'ENTREE' ? 1 : 5, 10)),
    type,
  };
}

describe('planifierReportStock', () => {
  it('reporte 7 unités de 2000 à 2003, matérialise les ouvertures absentes et reste idempotent', () => {
    const exercices = [
      exercise(1, 2000, [movement(101, 2000, 'ENTREE', '7')], '0'),
      exercise(2, 2001),
      exercise(3, 2002),
      exercise(4, 2003),
      exercise(5, 2023),
      exercise(6, 2024),
    ];

    const premier = planifierReportStock(exercices);
    const donneesApresReconciliation = [
      exercices[0],
      ...exercices.slice(1).map((item) => ({
        ...item,
        details: [{
          id: item.id + 1000,
          articleId: 7,
          prixUnitaire: new Prisma.Decimal('400000'),
          existantDebut: new Prisma.Decimal('7'),
          entrees: new Prisma.Decimal('0'),
          sorties: new Prisma.Decimal('0'),
        }],
      })),
    ];
    const second = planifierReportStock(donneesApresReconciliation);
    const lots2003 = premier.lots.filter((lot) => lot.exerciceId === 4);

    expect(lots2003).toHaveLength(1);
    expect(lots2003[0]).toMatchObject({
      sourceType: 'STOCK_INITIAL',
      articleId: 7,
      annee: 2003,
      quantiteInitiale: new Prisma.Decimal('7'),
      quantiteRestante: new Prisma.Decimal('7'),
    });
    expect(premier.detailsReportes.map((detail) => [
      detail.compteMatiereId,
      detail.existantDebut.toString(),
    ])).toEqual([
      [102, '7'],
      [103, '7'],
      [104, '7'],
      [105, '7'],
      [106, '7'],
    ]);
    expect(premier.lots.map((lot) => lot.key)).toEqual(
      second.lots.map((lot) => lot.key),
    );
    expect(second.detailsReportes).toHaveLength(0);
    expect(new Set(premier.lots.map((lot) => lot.key)).size).toBe(
      premier.lots.length,
    );
  });

  it('applique les sorties intermédiaires avant de reporter et refuse le double comptage', () => {
    const exercices = [
      exercise(1, 2000, [movement(101, 2000, 'ENTREE', '7')], '0'),
      exercise(2, 2001, [], '0'),
      exercise(3, 2002, [movement(202, 2002, 'SORTIE', '2')], '0'),
      exercise(4, 2003, [], '0'),
    ];

    const plan = planifierReportStock(exercices);
    const report2003 = plan.lots.filter((lot) => lot.exerciceId === 4);
    const detail2003 = plan.detailsReportes.find(
      (detail) => detail.compteMatiereId === 104,
    );

    expect(plan.affectations).toEqual([
      expect.objectContaining({
        mouvementSortieId: 202,
        quantite: new Prisma.Decimal('2'),
      }),
    ]);
    expect(report2003).toHaveLength(1);
    expect(report2003[0].quantiteInitiale.toString()).toBe('5');
    expect(detail2003?.existantDebut.toString()).toBe('5');
    expect(plan.lots.filter((lot) => lot.exerciceId === 3)[0].quantiteRestante.toString()).toBe('5');
  });

  it('ne prépare pas de report après épuisement du stock', () => {
    const exercices = [
      exercise(1, 2000, [movement(101, 2000, 'ENTREE', '7')], '0'),
      exercise(2, 2001),
      exercise(3, 2002, [movement(202, 2002, 'SORTIE', '7')]),
      exercise(4, 2003),
    ];

    const plan = planifierReportStock(exercices);

    expect(plan.lots.some((lot) => lot.exerciceId === 4)).toBe(false);
    expect(plan.detailsReportes.some((detail) => detail.compteMatiereId === 104)).toBe(false);
    expect(plan.affectations).toEqual([
      expect.objectContaining({
        mouvementSortieId: 202,
        quantite: new Prisma.Decimal('7'),
      }),
    ]);
  });

  it('refuse une ouverture non nulle qui diverge du report au lieu de la remplacer', () => {
    expect(() => planifierReportStock([
      exercise(1, 2000, [movement(101, 2000, 'ENTREE', '7')], '0'),
      exercise(2, 2003, [], '3'),
    ])).toThrow('Ouverture ambiguë');
  });
});
