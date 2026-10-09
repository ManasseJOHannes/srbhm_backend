import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExercicesService } from './exercices.service.js';

describe('ExercicesService SOA access control', () => {
  const exercise = { id: 21, annee: 2025, soaId: 12, statut: 'EN_COURS' };
  const makeService = (soaId: number | null, role = 'DEPOSITEUR_COMPTABLE') => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ role, soaId }) },
      exercice: {
        findUnique: vi.fn().mockResolvedValue(exercise),
        update: vi.fn().mockResolvedValue({ ...exercise, statut: 'CLOTURE' }),
        delete: vi.fn().mockResolvedValue(exercise),
      },
    };
    return { service: new ExercicesService(prisma as never, {} as never), prisma };
  };

  const makeCreateService = () => {
    const created = { id: 30, annee: 2025, soaId: 12 };
    const tx = {
      exercice: {
        create: vi.fn().mockResolvedValue(created),
        findUnique: vi.fn().mockResolvedValue({
          ...created,
          soa: { id: 12 },
          compteMatiere: { id: 90, details: [] },
        }),
      },
      compteMatiere: { create: vi.fn().mockResolvedValue({ id: 90 }) },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 4, soaId: 12, role: 'DEPOSITEUR_COMPTABLE' }) },
      sOA: { findUnique: vi.fn().mockResolvedValue({ id: 12 }) },
      exercice: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const mouvementService = {
      reporterStockDepuisExercicePrecedent: vi.fn().mockResolvedValue({ reporte: false }),
    };
    return {
      service: new ExercicesService(prisma as never, mouvementService as never),
      prisma,
      tx,
      mouvementService,
    };
  };

  it('crée le Compte Matière et lance le report dans la transaction de création', async () => {
    const { service, prisma, tx, mouvementService } = makeCreateService();

    await expect(service.create({ annee: 2025 }, 4)).resolves.toMatchObject({
      id: 30,
      compteMatiere: { id: 90 },
    });

    expect(tx.compteMatiere.create).toHaveBeenCalledWith({
      data: { exerciceId: 30 },
    });
    expect(mouvementService.reporterStockDepuisExercicePrecedent).toHaveBeenCalledWith(
      30,
      4,
      tx,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('ne crée pas un exercice déjà présent pour le SOA', async () => {
    const { service, prisma } = makeCreateService();
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue({ id: 30 } as never);

    await expect(service.create({ annee: 2025 }, 4)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows a depositor to consult an exercise from their SOA', async () => {
    const { service } = makeService(12);

    await expect(service.findOne(21, 4)).resolves.toMatchObject({ soaId: 12 });
  });

  it('hides another SOA exercise during consultation', async () => {
    const { service } = makeService(99);

    await expect(service.findOne(21, 4)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows update on own exercise and rejects update on another SOA', async () => {
    const own = makeService(12);
    await expect(
      own.service.update(21, { statut: 'CLOTURE' } as never, 4),
    ).resolves.toMatchObject({ statut: 'CLOTURE' });

    const foreign = makeService(99);
    await expect(
      foreign.service.update(21, { statut: 'CLOTURE' } as never, 4),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(foreign.prisma.exercice.update).not.toHaveBeenCalled();
  });

  it('allows deletion on own exercise and rejects deletion on another SOA', async () => {
    const own = makeService(12);
    await expect(own.service.remove(21, 4)).resolves.toEqual(exercise);

    const foreign = makeService(99);
    await expect(foreign.service.remove(21, 4)).rejects.toBeInstanceOf(NotFoundException);
    expect(foreign.prisma.exercice.delete).not.toHaveBeenCalled();
  });

  it('refuses modification for a role without the existing depositor permission', async () => {
    const { service, prisma } = makeService(12, 'COMPTABLE');

    await expect(
      service.update(21, { statut: 'CLOTURE' } as never, 4),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.exercice.update).not.toHaveBeenCalled();
  });
});
