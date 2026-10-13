import { StockReportService } from './stock-report.service.js';

function makeService() {
  const prisma = {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 4, role: 'COMPTABLE', soaId: 12 }),
    },
    sOA: { findUnique: vi.fn().mockResolvedValue({ id: 12 }) },
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
                sorties: 12,
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
});
