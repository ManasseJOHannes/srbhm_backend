import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompteMatieresService } from './compte-matieres.service.js';

const depositaire = { role: 'DEPOSITEUR_COMPTABLE', soaId: 12 };
const exercice = { id: 5, annee: 2025, soaId: 12, statut: 'EN_COURS' };

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 4, ...depositaire }) },
    exercice: { findUnique: vi.fn().mockResolvedValue(exercice) },
    compteMatiere: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 9, ...data })),
      delete: vi.fn().mockResolvedValue({ id: 9 }),
    },
    article: { findUnique: vi.fn().mockResolvedValue({ id: 3 }) },
    detailCompteMatiere: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 7, ...data })),
    },
    mouvement: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) =>
      callback({
        detailCompteMatiere: { findMany: vi.fn().mockResolvedValue([]) },
        compteMatiere: { update: vi.fn().mockResolvedValue({ id: 9 }) },
      }),
    ),
    ...overrides,
  };
  return { service: new CompteMatieresService(prisma as never), prisma };
}

describe('CompteMatieresService règles de gestion', () => {
  it("refuse un second compte sur le même exercice (R0c)", async () => {
    const { service, prisma } = makeService({
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue({ id: 9 }),
        create: vi.fn(),
        delete: vi.fn(),
      },
    });
    await expect(service.create({ exerciceId: 5 }, 4)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.compteMatiere.create).not.toHaveBeenCalled();
  });

  it("refuse la création sur un exercice d'un autre SOA (R0b)", async () => {
    const { service } = makeService({
      exercice: {
        findUnique: vi.fn().mockResolvedValue({ ...exercice, soaId: 99 }),
      },
    });
    await expect(service.create({ exerciceId: 5 }, 4)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("refuse la création sur un exercice clôturé (R3)", async () => {
    const { service } = makeService({
      exercice: {
        findUnique: vi.fn().mockResolvedValue({ ...exercice, statut: 'CLOTURE' }),
      },
    });
    await expect(service.create({ exerciceId: 5 }, 4)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("refuse un détail en double article × prix (R1)", async () => {
    const compte = {
      id: 9,
      exerciceId: 5,
      exercice,
      details: [],
      valeurExistanteDebut: 0,
      valeurEntrees: 0,
      valeurSorties: 0,
    };
    const { service } = makeService({
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue(compte),
        create: vi.fn(),
        delete: vi.fn(),
      },
      detailCompteMatiere: {
        findUnique: vi.fn().mockResolvedValue({ id: 7 }),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
    });
    await expect(
      service.addDetail(9, { articleId: 3, prixUnitaire: 100, existantDebut: 5 }, 4),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuse la suppression d'un compte avec détails (R0c)", async () => {    const zero = { equals: (n: number) => n === 0 };
    const compte = {
      id: 9,
      exerciceId: 5,
      exercice,
      details: [{ id: 7 }],
      valeurExistanteDebut: zero,
      valeurEntrees: zero,
      valeurSorties: zero,
    };
    const { service } = makeService({
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue(compte),
        create: vi.fn(),
        delete: vi.fn(),
      },
    });
    await expect(service.remove(9, 4)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reporte les restes N-1 en existant de N avec folio et observation', async () => {
    const source = {
      id: 5, annee: 2025, soaId: 12, statut: 'CLOTURE',
      compteMatiere: {
        details: [
          { articleId: 3, prixUnitaire: 100, folioGrandLivre: 12, observation: 'Facture N°200', existantDebut: 10, entrees: 4, sorties: 2, article: { designation: 'Chaise' } },
          { articleId: 4, prixUnitaire: 50, folioGrandLivre: null, observation: null, existantDebut: 0, entrees: 0, sorties: 0, article: { designation: 'Table' } },
        ],
      },
    };
    const tx = {
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 10 }),
        update: vi.fn().mockResolvedValue({ id: 10 }),
      },
      detailCompteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 8 }),
      },
    };
    const prisma = {
      exercice: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(source)
          .mockResolvedValueOnce({ id: 6, annee: 2026, soaId: 12, statut: 'EN_COURS' }),
      },
      $transaction: vi.fn((callback: (t: unknown) => unknown) => callback(tx)),
    };
    const { service } = makeService(prisma as unknown as Record<string, unknown>);
    const bilan = await service.reporterSoldes(5);
    // reste = 10 + 4 - 2 = 12 > 0 → recopié ; 0 ignoré
    expect(bilan).toMatchObject({ reporte: true, reportes: 1, ignores: 1 });
    expect(tx.detailCompteMatiere.create).toHaveBeenCalledTimes(1);
    expect(tx.detailCompteMatiere.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          articleId: 3,
          existantDebut: 12,
          folioGrandLivre: 12,
          observation: 'Facture N°200',
        }),
      }),
    );
  });

  it('génère une observation unique avec désignation si absente', async () => {
    const source = {
      id: 5, annee: 2025, soaId: 12, statut: 'CLOTURE',
      compteMatiere: {
        details: [
          { articleId: 3, prixUnitaire: 100, folioGrandLivre: null, observation: null, existantDebut: 5, entrees: 0, sorties: 0, article: { designation: 'Chaise' } },
        ],
      },
    };
    const tx = {
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 10 }),
        update: vi.fn().mockResolvedValue({ id: 10 }),
      },
      detailCompteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 8 }),
      },
    };
    const prisma = {
      exercice: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(source)
          .mockResolvedValueOnce({ id: 6, annee: 2026, soaId: 12, statut: 'EN_COURS' }),
      },
      $transaction: vi.fn((callback: (t: unknown) => unknown) => callback(tx)),
    };
    const { service } = makeService(prisma as unknown as Record<string, unknown>);
    await service.reporterSoldes(5);
    expect(tx.detailCompteMatiere.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          observation: "Stock reporté de l'exercice 2025 — Chaise",
        }),
      }),
    );
  });

  it('signale les détails déjà présents au lieu de les écraser', async () => {
    const source = {
      id: 5, annee: 2025, soaId: 12, statut: 'CLOTURE',
      compteMatiere: {
        details: [
          { articleId: 3, prixUnitaire: 100, folioGrandLivre: 7, observation: null, existantDebut: 8, entrees: 0, sorties: 0, article: { designation: 'Chaise' } },
        ],
      },
    };
    const tx = {
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue({ id: 10 }),
        update: vi.fn().mockResolvedValue({ id: 10 }),
      },
      detailCompteMatiere: {
        findUnique: vi.fn().mockResolvedValue({ id: 8, existantDebut: 5 }),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
    };
    const prisma = {
      exercice: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(source)
          .mockResolvedValueOnce({ id: 6, annee: 2026, soaId: 12, statut: 'EN_COURS' }),
      },
      $transaction: vi.fn((callback: (t: unknown) => unknown) => callback(tx)),
    };
    const { service } = makeService(prisma as unknown as Record<string, unknown>);
    const bilan = await service.reporterSoldes(5);
    expect(bilan).toMatchObject({
      reporte: true,
      reportes: 0,
      conflits: [{ articleId: 3, prixUnitaire: 100, existantEnregistre: 5, quantiteReportee: 8 }],
    });
    expect(tx.detailCompteMatiere.create).not.toHaveBeenCalled();
  });

  it("reprend les justificatifs des mouvements sources quand le détail n'a pas d'observation", async () => {
    const source = {
      id: 5, annee: 2025, soaId: 12, statut: 'CLOTURE',
      compteMatiere: {
        details: [
          { articleId: 3, prixUnitaire: 100, folioGrandLivre: null, observation: null, existantDebut: 0, entrees: 5, sorties: 0, article: { designation: 'Chaise' } },
        ],
      },
    };
    const tx = {
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 10 }),
        update: vi.fn().mockResolvedValue({ id: 10 }),
      },
      detailCompteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 8 }),
      },
    };
    const prisma = {
      exercice: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(source)
          .mockResolvedValueOnce({ id: 6, annee: 2026, soaId: 12, statut: 'EN_COURS' }),
      },
      mouvement: {
        findMany: vi.fn().mockResolvedValue([
          { articleId: 3, prixUnitaire: 100, observation: 'Facture N°200' },
          { articleId: 3, prixUnitaire: 100, observation: '  Facture N°200  ' },
          { articleId: 3, prixUnitaire: 100, observation: 'Bon 12' },
          { articleId: 9, prixUnitaire: 7, observation: 'Autre article' },
          { articleId: 3, prixUnitaire: 100, observation: null },
        ]),
      },
      $transaction: vi.fn((callback: (t: unknown) => unknown) => callback(tx)),
    };
    const { service } = makeService(prisma as unknown as Record<string, unknown>);
    await service.reporterSoldes(5);
    expect(tx.detailCompteMatiere.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          observation: 'Facture N°200 ; Bon 12',
        }),
      }),
    );
  });

  it("conserve l'observation du détail source même avec des mouvements", async () => {
    const source = {
      id: 5, annee: 2025, soaId: 12, statut: 'CLOTURE',
      compteMatiere: {
        details: [
          { articleId: 3, prixUnitaire: 100, folioGrandLivre: null, observation: 'Facture initiale', existantDebut: 5, entrees: 0, sorties: 0, article: { designation: 'Chaise' } },
        ],
      },
    };
    const tx = {
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 10 }),
        update: vi.fn().mockResolvedValue({ id: 10 }),
      },
      detailCompteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 8 }),
      },
    };
    const prisma = {
      exercice: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(source)
          .mockResolvedValueOnce({ id: 6, annee: 2026, soaId: 12, statut: 'EN_COURS' }),
      },
      mouvement: {
        findMany: vi.fn().mockResolvedValue([
          { articleId: 3, prixUnitaire: 100, observation: 'Facture mouvement' },
        ]),
      },
      $transaction: vi.fn((callback: (t: unknown) => unknown) => callback(tx)),
    };
    const { service } = makeService(prisma as unknown as Record<string, unknown>);
    await service.reporterSoldes(5);
    expect(tx.detailCompteMatiere.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ observation: 'Facture initiale' }),
      }),
    );
  });

  it("désambiguïse avec la désignation en cas d'observation déjà prise", async () => {
    const source = {
      id: 5, annee: 2025, soaId: 12, statut: 'CLOTURE',
      compteMatiere: {
        details: [
          { articleId: 3, prixUnitaire: 100, folioGrandLivre: null, observation: null, existantDebut: 5, entrees: 0, sorties: 0, article: { designation: 'Chaise' } },
          { articleId: 4, prixUnitaire: 200, folioGrandLivre: null, observation: null, existantDebut: 2, entrees: 0, sorties: 0, article: { designation: 'Table' } },
        ],
      },
    };
    const tx = {
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 10 }),
        update: vi.fn().mockResolvedValue({ id: 10 }),
      },
      detailCompteMatiere: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 8 }),
      },
    };
    const prisma = {
      exercice: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(source)
          .mockResolvedValueOnce({ id: 6, annee: 2026, soaId: 12, statut: 'EN_COURS' }),
      },
      mouvement: {
        findMany: vi.fn().mockResolvedValue([
          { articleId: 3, prixUnitaire: 100, observation: 'Facture 1234' },
          { articleId: 4, prixUnitaire: 200, observation: 'Facture 1234' },
        ]),
      },
      $transaction: vi.fn((callback: (t: unknown) => unknown) => callback(tx)),
    };
    const { service } = makeService(prisma as unknown as Record<string, unknown>);
    await service.reporterSoldes(5);
    const calls = tx.detailCompteMatiere.create.mock.calls.map(
      (call) => (call[0] as { data: { observation: string } }).data.observation,
    );
    expect(calls).toEqual(['Facture 1234', 'Facture 1234 — Table']);
  });

  it("n'écrit jamais sur un exercice cible clôturé", async () => {
    const source = {
      id: 5, annee: 2025, soaId: 12, statut: 'CLOTURE',
      compteMatiere: { details: [] },
    };
    const prisma = {
      exercice: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(source)
          .mockResolvedValueOnce({ id: 6, annee: 2026, soaId: 12, statut: 'CLOTURE' }),
      },
      $transaction: vi.fn(),
    };
    const { service } = makeService(prisma as unknown as Record<string, unknown>);
    const bilan = await service.reporterSoldes(5);
    expect(bilan).toMatchObject({ reporte: false, raison: 'EXERCICE_SUIVANT_CLOTURE' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
