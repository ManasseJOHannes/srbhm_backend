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

describe('MouvementsService règles de gestion', () => {
  it("refuse toute écriture sur exercice clôturé (R3)", async () => {
    const { service } = makeService({
      exercice: {
        findUnique: vi.fn().mockResolvedValue({ ...exercice, statut: 'CLOTURE' }),
      },
    });
    await expect(service.create(dto, 4)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse une date hors exercice (R4)", async () => {
    const { service } = makeService();
    await expect(
      service.create({ ...dto, date: '2024-06-15' }, 4),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuse une sortie sans stock suffisant (R2)", async () => {
    const txDetail = { id: 7, existantDebut: 2, entrees: 0, sorties: 0 };
    const { service } = makeService();
    // réécrit le mock tx via overrides internes : on rejoue avec détail existant
    const tx2 = {
      compteMatiere: {
        findUnique: vi.fn().mockResolvedValue({ id: 9 }),
        update: vi.fn(),
      },
      detailCompteMatiere: {
        findUnique: vi.fn().mockResolvedValue(txDetail),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
      mouvement: { create: vi.fn() },
    };
    const prisma2 = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 4, ...depositaire }) },
      exercice: { findUnique: vi.fn().mockResolvedValue(exercice) },
      article: { findUnique: vi.fn().mockResolvedValue({ id: 3 }) },
      $transaction: vi.fn((cb: (t: unknown) => unknown) => cb(tx2)),
    };
    const service2 = new MouvementsService(prisma2 as never);
    await expect(
      service2.create({ ...dto, type: 'SORTIE' as const, quantite: 5 }, 4),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service).toBeDefined();
  });

  it("crée le mouvement + met à jour le détail et les valeurs (R2)", async () => {
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
});
