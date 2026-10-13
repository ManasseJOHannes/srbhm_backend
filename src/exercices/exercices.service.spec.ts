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
    const compteMatieresService = {
      reporterSoldes: vi.fn().mockResolvedValue({ reporte: false }),
    };
    return {
      service: new ExercicesService(prisma as never, compteMatieresService as never),
      prisma,
      compteMatieresService,
    };
  };

  const makeCreateService = () => {
    const created = { id: 30, annee: 2025, soaId: 12 };
    const tx = {
      exercice: {
        create: vi.fn().mockResolvedValue(created),
        findUnique: vi.fn().mockResolvedValue({
          ...created,
          soa: { id: 12 },
        }),
      },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 4, soaId: 12, role: 'DEPOSITEUR_COMPTABLE' }) },
      sOA: { findUnique: vi.fn().mockResolvedValue({ id: 12 }) },
      exercice: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const compteMatieresService = {
      reporterSoldes: vi.fn(),
      reporterDepuisDernierCloture: vi
        .fn()
        .mockResolvedValue({ reporte: false, raison: 'AUCUN_CLOTURE_ANTERIEUR' }),
    };
    return {
      service: new ExercicesService(prisma as never, compteMatieresService as never),
      prisma,
      tx,
      compteMatieresService,
    };
  };

  it('crée un exercice nu (sans compte matière ni report) dans la transaction de création', async () => {
    const { service, prisma, tx, compteMatieresService } = makeCreateService();

    await expect(service.create({ annee: 2025 }, 4)).resolves.toMatchObject({
      exercice: { id: 30, soa: { id: 12 } },
    });

    expect(tx.exercice.create).toHaveBeenCalledWith({
      data: {
        annee: 2025,
        dateDebut: expect.any(Date),
        dateFin: expect.any(Date),
        soaId: 12,
        statut: 'EN_COURS',
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(
      compteMatieresService.reporterDepuisDernierCloture,
    ).toHaveBeenCalledWith(12, 2025);
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
    ).resolves.toMatchObject({ exercice: { statut: 'CLOTURE' } });

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

  it('reporte les soldes vers N+1 à la clôture (R3)', async () => {
    const { service, compteMatieresService } = makeService(12);

    await expect(
      service.update(21, { statut: 'CLOTURE' } as never, 4),
    ).resolves.toMatchObject({ exercice: { statut: 'CLOTURE' } });
    expect(compteMatieresService.reporterSoldes).toHaveBeenCalledWith(21);
  });

  it('refuse de rouvrir un exercice clôturé (R3 irréversible)', async () => {
    const { service, prisma, compteMatieresService } = makeService(12);
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue({
      ...exercise,
      statut: 'CLOTURE',
    } as never);

    await expect(
      service.update(21, { statut: 'EN_COURS' } as never, 4),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.exercice.update).not.toHaveBeenCalled();
    expect(compteMatieresService.reporterSoldes).not.toHaveBeenCalled();
  });
});
