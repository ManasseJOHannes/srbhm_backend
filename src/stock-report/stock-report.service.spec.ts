import { StockReportService } from './stock-report.service.js';

function makeService() {
  const prisma = {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 4, role: 'COMPTABLE', soaId: 12 }),
    },
    sOA: { findUnique: vi.fn().mockResolvedValue({ id: 12 }) },
    mouvement: { findMany: vi.fn().mockResolvedValue([]) },
    exercice: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 5,
          annee: 2025,
          compteMatiere: {
            details: [
              {
                articleId: 3,
                prixUnitaire: 100,
                existantDebut: 10,
                entrees: 0,
                sorties: 0,
                article: { designation: 'Chaise', unite: 'pièce' },
              },
              {
                articleId: 4,
                prixUnitaire: 50,
                existantDebut: 5,
                entrees: 0,
                sorties: 1,
                article: { designation: 'Table', unite: 'pièce' },
              },
            ],
          },
          mouvements: [
            { type: 'SORTIE', articleId: 3, prixUnitaire: 100, quantite: 12 },
            { type: 'ENTREE', articleId: 4, prixUnitaire: 50, quantite: 9 },
          ],
        },
      ]),
    },
  };
  return { service: new StockReportService(prisma as never), prisma };
}

describe('StockReportService règles de gestion', () => {
  it('signale les stocks négatifs', async () => {
    const { service } = makeService();
    const report = await service.simuler(12, 4);
    expect(report.lignes).toHaveLength(2);
    expect(report.lignes[0]).toMatchObject({
      stockFinal: -2,
      stockNegatif: true,
    });
    expect(report.lignes[1]).toMatchObject({ stockNegatif: false });
    expect(report.avertissement).toContain('1 ligne(s)');
  });

  it('compte les sorties de l’année', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.exercice.findMany).mockResolvedValue([
      {
        id: 5,
        annee: 2025,
        compteMatiere: {
          details: [
            {
              articleId: 3,
              prixUnitaire: 100,
              existantDebut: 10,
              entrees: 0,
              sorties: 0,
              article: { designation: 'Chaise', unite: 'pièce' },
            },
          ],
        },
        mouvements: [
          { type: 'SORTIE', articleId: 3, prixUnitaire: 100, quantite: 4 },
        ],
      },
    ] as never);
    const report = await service.simuler(12, 4);
    expect(report.lignes[0]).toMatchObject({ sorties: 4, stockFinal: 6 });
  });

  it('ne signale aucun négatif quand R2 est respectée', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.exercice.findMany).mockResolvedValue([
      {
        id: 5,
        annee: 2025,
        compteMatiere: {
          details: [
            {
              id: 9,
              articleId: 3,
              prixUnitaire: 100,
              existantDebut: 20,
              entrees: 0,
              sorties: 16,
              article: { designation: 'Chaise', unite: 'pièce' },
            },
          ],
        },
        mouvements: [
          { type: 'SORTIE', articleId: 3, prixUnitaire: 100, quantite: 16 },
        ],
      },
    ] as never);
    const report = await service.simuler(12, 4);
    // 20 + 0 − 16 = 4 : sorties cumulées ≤ existant, jamais négatif.
    expect(report.lignes[0]).toMatchObject({
      sorties: 16,
      stockFinal: 4,
      stockNegatif: false,
    });
    expect(report.lignes[0]).not.toHaveProperty('reprises');
    expect(report.lignes[0]).not.toHaveProperty('preleveUlterieur');
    expect(report.avertissement).toBe('Aucune anomalie détectée');
  });
});
