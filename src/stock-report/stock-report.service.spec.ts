import { Prisma } from '@prisma/client';
import { Role } from '@prisma/client';
import { StockReportService } from './stock-report.service.js';

type DetailFixture = {
  id: number;
  articleId: number;
  prixUnitaire: Prisma.Decimal;
  existantDebut: Prisma.Decimal;
  entrees: Prisma.Decimal;
  sorties: Prisma.Decimal;
};

function makeDetail(
  id: number,
  articleId: number,
  price: string,
  opening: string,
  entries = '0',
  exits = '0',
): DetailFixture & { article: { designation: string } } {
  return {
    id,
    articleId,
    prixUnitaire: new Prisma.Decimal(price),
    existantDebut: new Prisma.Decimal(opening),
    entrees: new Prisma.Decimal(entries),
    sorties: new Prisma.Decimal(exits),
    article: { designation: `Article ${articleId}` },
  };
}

function makeExercise(
  id: number,
  year: number,
  details: ReturnType<typeof makeDetail>[],
  lotsStock: Array<{
    id: number;
    articleId: number;
    designation: string;
    prixUnitaire: Prisma.Decimal;
    quantiteInitiale: Prisma.Decimal;
    quantiteRestante: Prisma.Decimal;
    lotParentId: number | null;
  }> = [],
  mouvements: Array<{
    id: number;
    articleId: number;
    prixUnitaire: string;
    quantite: string;
    type: 'ENTREE' | 'SORTIE';
  }> = [],
) {
  return {
    id,
    annee: year,
    soaId: 9,
    compteMatiere: { id: id + 100, details },
    mouvements: mouvements.map((mouvement) => ({
      ...mouvement,
      prixUnitaire: new Prisma.Decimal(mouvement.prixUnitaire),
      quantite: new Prisma.Decimal(mouvement.quantite),
      article: { designation: `Article ${mouvement.articleId}` },
    })),
    lotsStock: lotsStock.map(({ designation, ...lot }) => ({
      ...lot,
      article: { designation },
    })),
  };
}

function serviceFor(
  exercises: ReturnType<typeof makeExercise>[],
  role = Role.DEPOSITEUR_COMPTABLE,
  soaId: number | null = 9,
) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ role, soaId }),
    },
    sOA: {
      findUnique: vi.fn().mockResolvedValue({ id: 9 }),
    },
    exercice: {
      findMany: vi.fn().mockResolvedValue(exercises),
    },
  };

  return new StockReportService(prisma as never);
}

describe('StockReportService.simulerReportStock', () => {
  it('conserve visible un report non matérialisé au lieu de masquer l’écart du détail', async () => {
    const exercises = [
      makeExercise(
        1,
        2000,
        [makeDetail(1, 7, '400000', '0', '7')],
        [],
        [{
          id: 101,
          articleId: 7,
          prixUnitaire: '400000',
          quantite: '7',
          type: 'ENTREE',
        }],
      ),
      makeExercise(2, 2001, []),
      makeExercise(3, 2002, []),
      makeExercise(4, 2003, []),
      makeExercise(5, 2023, []),
      makeExercise(6, 2024, []),
    ];

    const result = await serviceFor(exercises).simulerReportStock(9, 4);

    for (const annee of [2003, 2023, 2024]) {
      const exercice = result.exercices.find((item) => item.annee === annee)!;
      expect(exercice.lignes[0]).toMatchObject({
        prixUnitaire: '400000',
        stockInitialEnregistre: '0',
        stockInitialCalcule: '7',
        stockFinal: '7',
        ecartStockInitial: '-7',
      });
      expect(exercice.lignes[0].source).toContain('REPORT_EXERCICE_PRECEDENT');
    }
  });

  it('ne propage pas un lot initial erroné après une sortie intermédiaire', async () => {
    const price = new Prisma.Decimal('400000');
    const exercises = [
      makeExercise(
        14,
        2000,
        [makeDetail(4, 4, '400000', '0', '7')],
        [{
          id: 12,
          articleId: 4,
          designation: 'Table ronde',
          prixUnitaire: price,
          quantiteInitiale: new Prisma.Decimal('7'),
          quantiteRestante: new Prisma.Decimal('7'),
          lotParentId: null,
        }],
        [{
          id: 8,
          articleId: 4,
          prixUnitaire: '400000',
          quantite: '7',
          type: 'ENTREE',
        }],
      ),
      makeExercise(
        15,
        2001,
        [makeDetail(7, 4, '400000', '7', '0', '1')],
        [{
          id: 15,
          articleId: 4,
          designation: 'Table ronde',
          prixUnitaire: price,
          quantiteInitiale: new Prisma.Decimal('7'),
          quantiteRestante: new Prisma.Decimal('6.21'),
          lotParentId: 12,
        }],
        [{
          id: 9,
          articleId: 4,
          prixUnitaire: '400000',
          quantite: '0.79',
          type: 'SORTIE',
        }, {
          id: 10,
          articleId: 4,
          prixUnitaire: '400000',
          quantite: '0.21',
          type: 'SORTIE',
        }],
      ),
      // L'exercice 2002 existe et a un compte, mais aucun mouvement :
      // il doit conserver le solde réel de 6 avant le report non consécutif.
      makeExercise(16, 2002, [makeDetail(10, 4, '400000', '6')]),
      makeExercise(
        13,
        2003,
        [makeDetail(5, 4, '400000', '7')],
        [{
          id: 13,
          articleId: 4,
          designation: 'Table ronde',
          prixUnitaire: price,
          quantiteInitiale: new Prisma.Decimal('7'),
          quantiteRestante: new Prisma.Decimal('7'),
          lotParentId: 12,
        }],
      ),
      makeExercise(
        8,
        2023,
        [makeDetail(6, 4, '400000', '7')],
        [{
          id: 14,
          articleId: 4,
          designation: 'Table ronde',
          prixUnitaire: price,
          quantiteInitiale: new Prisma.Decimal('7'),
          quantiteRestante: new Prisma.Decimal('7'),
          lotParentId: 13,
        }],
      ),
      makeExercise(3, 2024, []),
      makeExercise(2, 2025, []),
    ];

    const result = await serviceFor(exercises).simulerReportStock(9, 4);
    const lineFor = (year: number) =>
      result.exercices.find((exercise) => exercise.annee === year)!.lignes[0];

    expect(lineFor(2000).stockFinal).toBe('7');
    // Les deux sorties (0,79 + 0,21) sont des mouvements distincts :
    // le solde réel calculé est 6, même si le lot source et les lots
    // reportés enregistrent encore 6,21 puis 7.
    expect(lineFor(2001)).toMatchObject({
      stockFinal: '6',
      stockFinalLots: '6.21',
      ecartStockFinalLots: '-0.21',
    });
    expect(lineFor(2002)).toMatchObject({
      stockInitialCalcule: '6',
      stockInitialEnregistre: '6',
      stockFinal: '6',
    });
    expect(lineFor(2003)).toMatchObject({
      stockInitialCalcule: '6',
      stockInitialEnregistre: '7',
      stockFinal: '6',
      stockFinalLots: '7',
      ecartStockFinalLots: '-1',
    });
    expect(lineFor(2003).source).toContain(
      'ECART_REPORT_LOTS:calcule(6)-lots(7)',
    );
    expect(lineFor(2023)).toMatchObject({
      stockInitialCalcule: '6',
      stockInitialEnregistre: '7',
      stockFinal: '6',
    });
    for (const year of [2024, 2025]) {
      expect(lineFor(year)).toMatchObject({
        stockInitialCalcule: '6',
        stockInitialEnregistre: '0',
        stockFinal: '6',
      });
    }
  });

  it('ne recompte pas un lot enfant reporté dans l’exercice consécutif', async () => {
    const previousDetail = makeDetail(1, 7, '12.50', '10');
    const nextDetail = makeDetail(2, 7, '12.50', '10');
    const exercises = [
      makeExercise(21, 2023, [previousDetail]),
      makeExercise(22, 2024, [nextDetail], [
        {
          id: 80,
          articleId: 7,
          designation: 'Article 7',
          prixUnitaire: new Prisma.Decimal('12.50'),
          quantiteInitiale: new Prisma.Decimal('10'),
          quantiteRestante: new Prisma.Decimal('10'),
          lotParentId: 55,
        },
      ]),
    ];

    const result = await serviceFor(exercises).simulerReportStock(9, 4);
    const [source, destination] = result.exercices;

    expect(source.lignes[0].stockFinal).toBe('10');
    expect(destination.lignes[0].stockInitialCalcule).toBe('10');
    expect(destination.lignes[0].stockFinal).toBe('10');
    expect(destination.lignes[0].source).toContain(
      'REPORT_LOTS_ENFANTS:80',
    );
    expect(destination.lignes[0].source).not.toContain(
      'ECART_REPORT_LOTS:calcule(10)-lots(10)',
    );
  });

  it('reporte les lots vers l’exercice non consécutif par article et prix', async () => {
    const sourceDetails = [
      makeDetail(1, 7, '12.50', '10'),
      makeDetail(2, 7, '3.25', '4'),
    ];
    const destinationDetails = [
      makeDetail(3, 7, '12.50', '10'),
      makeDetail(4, 7, '3.25', '4'),
    ];
    const exercises = [
      makeExercise(31, 2021, sourceDetails),
      makeExercise(34, 2024, destinationDetails, [
        {
          id: 91,
          articleId: 7,
          designation: 'Article 7',
          prixUnitaire: new Prisma.Decimal('12.50'),
          quantiteInitiale: new Prisma.Decimal('10'),
          quantiteRestante: new Prisma.Decimal('10'),
          lotParentId: 61,
        },
        {
          id: 92,
          articleId: 7,
          designation: 'Article 7',
          prixUnitaire: new Prisma.Decimal('3.25'),
          quantiteInitiale: new Prisma.Decimal('4'),
          quantiteRestante: new Prisma.Decimal('4'),
          lotParentId: 62,
        },
      ]),
    ];

    const result = await serviceFor(exercises).simulerReportStock(9, 4);
    const [source, destination] = result.exercices;

    expect(source.lignes).toHaveLength(2);
    expect(destination.lignes).toHaveLength(2);
    expect(destination.lignes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prixUnitaire: '12.5',
          stockInitialCalcule: '10',
          stockFinal: '10',
        }),
        expect.objectContaining({
          prixUnitaire: '3.25',
          stockInitialCalcule: '4',
          stockFinal: '4',
        }),
      ]),
    );
  });

  it('calcule le solde normal une seule fois et le confirme avec les lots', async () => {
    const exercise = makeExercise(
      41,
      2025,
      [makeDetail(5, 7, '12.50', '10', '5', '2')],
      [
        {
          id: 101,
          articleId: 7,
          designation: 'Article 7',
          prixUnitaire: new Prisma.Decimal('12.50'),
          quantiteInitiale: new Prisma.Decimal('10'),
          quantiteRestante: new Prisma.Decimal('8'),
          lotParentId: null,
        },
        {
          id: 102,
          articleId: 7,
          designation: 'Article 7',
          prixUnitaire: new Prisma.Decimal('12.50'),
          quantiteInitiale: new Prisma.Decimal('5'),
          quantiteRestante: new Prisma.Decimal('5'),
          lotParentId: null,
        },
      ],
      [
        {
          id: 201,
          articleId: 7,
          prixUnitaire: '12.50',
          quantite: '5',
          type: 'ENTREE',
        },
        {
          id: 202,
          articleId: 7,
          prixUnitaire: '12.50',
          quantite: '2',
          type: 'SORTIE',
        },
      ],
    );

    const result = await serviceFor([exercise]).simulerReportStock(9, 4);
    const ligne = result.exercices[0].lignes[0];

    expect(ligne.entrees).toBe('5');
    expect(ligne.sorties).toBe('2');
    expect(ligne.stockFinal).toBe('13');
    expect(ligne.stockFinalLots).toBe('13');
    expect(ligne.ecartEntreesDetailsMouvements).toBe('0');
    expect(ligne.ecartSortiesDetailsMouvements).toBe('0');
    expect(ligne.ecartStockFinalLots).toBe('0');
  });

  it('signale les désaccords sans additionner les détails et mouvements', async () => {
    const exercise = makeExercise(
      42,
      2025,
      [makeDetail(6, 7, '12.50', '10', '8', '2')],
      [
        {
          id: 103,
          articleId: 7,
          designation: 'Article 7',
          prixUnitaire: new Prisma.Decimal('12.50'),
          quantiteInitiale: new Prisma.Decimal('10'),
          quantiteRestante: new Prisma.Decimal('8'),
          lotParentId: null,
        },
        {
          id: 104,
          articleId: 7,
          designation: 'Article 7',
          prixUnitaire: new Prisma.Decimal('12.50'),
          quantiteInitiale: new Prisma.Decimal('5'),
          quantiteRestante: new Prisma.Decimal('4'),
          lotParentId: null,
        },
      ],
      [
        {
          id: 203,
          articleId: 7,
          prixUnitaire: '12.50',
          quantite: '5',
          type: 'ENTREE',
        },
        {
          id: 204,
          articleId: 7,
          prixUnitaire: '12.50',
          quantite: '2',
          type: 'SORTIE',
        },
      ],
    );

    const result = await serviceFor([exercise]).simulerReportStock(9, 4);
    const ligne = result.exercices[0].lignes[0];

    // Le mouvement est la source de flux : 10 + 5 - 2, pas 10 + 8 - 2.
    expect(ligne.stockFinal).toBe('13');
    expect(ligne.ecartEntreesDetailsMouvements).toBe('3');
    expect(ligne.ecartSortiesDetailsMouvements).toBe('0');
    expect(ligne.stockFinalLots).toBe('12');
    expect(ligne.ecartStockFinalLots).toBe('1');
    expect(ligne.source).toContain(
      'ECART_A_VERIFIER:details(8/2)-mouvements(5/2)',
    );
    expect(ligne.source).toContain(
      'ECART_STOCK_LOTS:calcule(13)-lots(12)',
    );
  });

  it('autorise le rapport du SOA du dépositaire', async () => {
    const { user, sOA, exercice } = getPrismaMocks();
    user.findUnique.mockResolvedValue({ role: Role.DEPOSITEUR_COMPTABLE, soaId: 9 });
    sOA.findUnique.mockResolvedValue({ id: 9 });
    exercice.findMany.mockResolvedValue([]);

    const service = new StockReportService({ user, sOA, exercice } as never);
    await expect(service.simulerReportStock(9, 4)).resolves.toMatchObject({ soaId: 9 });
    expect(exercice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { soaId: 9 } }));
  });

  it('refuse le rapport d’un autre SOA avant de charger les exercices', async () => {
    const { user, sOA, exercice } = getPrismaMocks();
    user.findUnique.mockResolvedValue({ role: Role.DEPOSITEUR_COMPTABLE, soaId: 9 });

    const service = new StockReportService({ user, sOA, exercice } as never);
    await expect(service.simulerChronologie(10, 4)).rejects.toThrow('SOA introuvable');
    await expect(service.simulerReportStock(10, 4)).rejects.toThrow('SOA introuvable');
    expect(sOA.findUnique).not.toHaveBeenCalled();
    expect(exercice.findMany).not.toHaveBeenCalled();
  });
});

function getPrismaMocks() {
  return {
    user: { findUnique: vi.fn() },
    sOA: { findUnique: vi.fn() },
    exercice: { findMany: vi.fn() },
  };
}
