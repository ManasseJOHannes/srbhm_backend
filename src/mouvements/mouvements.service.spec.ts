import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MouvementsService } from './mouvements.service.js';

const depositaire = { role: 'DEPOSITEUR_COMPTABLE', soaId: 12 };
const exercice = {
  id: 5,
  annee: 2025,
  soaId: 12,
  statut: 'EN_COURS',
  dateDebut: new Date(Date.UTC(2025, 0, 1)),
  dateFin: new Date(Date.UTC(2025, 11, 31)),
};
const dto = {
  type: 'ENTREE' as const,
  date: '2025-06-15',
  exerciceId: 5,
  articleId: 3,
  quantite: 10,
  prixUnitaire: 100,
};

function makeService(overrides: Record<string, unknown> = {}) {
  const tx = {
    compteMatiere: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 9 }),
      update: vi.fn().mockResolvedValue({ id: 9 }),
    },
    detailCompteMatiere: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi
        .fn()
        .mockResolvedValue({ id: 7, existantDebut: 0, entrees: 0, sorties: 0 }),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
    },
    mouvement: { create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 11, ...data })) },
  };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 4, ...depositaire }) },
    exercice: { findUnique: vi.fn().mockResolvedValue(exercice) },
    article: { findUnique: vi.fn().mockResolvedValue({ id: 3 }) },
    mouvement: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((callback: (t: unknown) => unknown) => callback(tx)),
    ...overrides,
  };
  return { service: new MouvementsService(prisma as never), prisma, tx };
}

function makeService2(txDetail: Record<string, unknown>) {
  const tx2 = {
    compteMatiere: {
      findUnique: vi.fn().mockResolvedValue({ id: 9 }),
      update: vi.fn().mockResolvedValue({ id: 9 }),
    },
    detailCompteMatiere: {
      findUnique: vi.fn().mockResolvedValue(txDetail),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
    },
    mouvement: { create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 11, ...data })) },
  };
  const prisma2 = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 4, ...depositaire }) },
    exercice: { findUnique: vi.fn().mockResolvedValue(exercice) },
    article: { findUnique: vi.fn().mockResolvedValue({ id: 3 }) },
    $transaction: vi.fn((cb: (t: unknown) => unknown) => cb(tx2)),
  };
  return { service2: new MouvementsService(prisma2 as never), tx2 };
}

describe('MouvementsService regles de gestion', () => {
  it('refuse toute ecriture sur exercice cloture (R3)', async () => {
    const { service } = makeService({
      exercice: {
        findUnique: vi.fn().mockResolvedValue({ ...exercice, statut: 'CLOTURE' }),
      },
    });
    await expect(service.create(dto, 4)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse une date hors exercice (R4)', async () => {
    const { service } = makeService();
    await expect(
      service.create({ ...dto, date: '2024-06-15' }, 4),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une sortie sans detail sur exercice courant', async () => {
    const { service } = makeService();
    await expect(
      service.create({ ...dto, type: 'SORTIE' as const }, 4),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une sortie qui depasserait existant, en cumul (R2)', async () => {
    // existant 20, deja 16 sortis : 16 + 5 = 21 > 20 -> refuse.
    const { service2, tx2 } = makeService2({
      id: 7,
      existantDebut: 20,
      entrees: 0,
      sorties: 16,
    });
    await expect(
      service2.create({ ...dto, type: 'SORTIE' as const, quantite: 5 }, 4),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx2.detailCompteMatiere.update).not.toHaveBeenCalled();
    expect(tx2.mouvement.create).not.toHaveBeenCalled();
  });

  it('accepte une sortie dans la limite de existant (R2)', async () => {
    // existant 20, deja 16 sortis : 16 + 4 = 20 <= 20 -> accepte.
    const { service2, tx2 } = makeService2({
      id: 7,
      existantDebut: 20,
      entrees: 0,
      sorties: 16,
    });
    const mouvement = await service2.create(
      { ...dto, type: 'SORTIE' as const, quantite: 4 },
      4,
    );
    expect(mouvement).toMatchObject({ type: 'SORTIE', quantite: 4 });
    expect(tx2.detailCompteMatiere.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 }, data: { sorties: 20 } }),
    );
  });

  it('cree le mouvement + met a jour le detail et les valeurs (R2)', async () => {
    const { service, tx } = makeService();
    vi.mocked(tx.detailCompteMatiere.findMany).mockResolvedValue([
      { existantDebut: 0, entrees: 10, sorties: 0, prixUnitaire: 100 },
    ] as never);
    const mouvement = await service.create(dto, 4);
    expect(mouvement).toMatchObject({ type: 'ENTREE', quantite: 10 });
    expect(tx.detailCompteMatiere.update).toHaveBeenCalled();
    expect(tx.compteMatiere.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9 },
        data: expect.objectContaining({ valeurRestante: 1000 }),
      }),
    );
  });

  it("masque les mouvements d'un autre SOA (R0b)", async () => {
    const { service } = makeService({
      exercice: {
        findUnique: vi.fn().mockResolvedValue({ ...exercice, soaId: 99 }),
      },
    });
    await expect(service.create(dto, 4)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("pose le folio à l'entrée sur détail sans folio", async () => {
    const { service, tx } = makeService();
    vi.mocked(tx.detailCompteMatiere.findUnique).mockResolvedValue({
      id: 7, existantDebut: 0, entrees: 0, sorties: 0, folioGrandLivre: null,
    } as never);
    await service.create({ ...dto, folioGrandLivre: 12 }, 4);
    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({ folioGrandLivre: 12 }),
      }),
    );
  });

  it("écrase le folio existant : dernière saisie fait foi", async () => {
    const { service, tx } = makeService();
    vi.mocked(tx.detailCompteMatiere.findUnique).mockResolvedValue({
      id: 7, existantDebut: 0, entrees: 0, sorties: 0, folioGrandLivre: 5,
    } as never);
    await service.create({ ...dto, folioGrandLivre: 12 }, 4);
    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({ folioGrandLivre: 12 }),
      }),
    );
  });
});
