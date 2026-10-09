import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { CompteMatieresService } from './compte-matieres.service.js';

const emptyCompte = () => ({
  id: 8,
  exerciceId: 21,
  valeurExistanteDebut: new Prisma.Decimal(0),
  valeurEntrees: new Prisma.Decimal(0),
  valeurSorties: new Prisma.Decimal(0),
  valeurRestante: new Prisma.Decimal(0),
  details: [] as unknown[],
  exercice: {
    id: 21,
    annee: 2024,
    soaId: 12,
    _count: { mouvements: 0, lotsStock: 0 },
  },
});

function makeService(options?: {
  role?: Role;
  userSoaId?: number | null;
  compte?: ReturnType<typeof emptyCompte> | null;
  exerciseForYear?: { id: number } | null;
}) {
  const compte = options?.compte === undefined ? emptyCompte() : options.compte;
  const tx = {
    compteMatiere: {
      findUnique: vi.fn().mockResolvedValue(compte),
      delete: vi.fn().mockResolvedValue(compte),
    },
    exercice: {
      findUnique: vi.fn().mockResolvedValue(options?.exerciseForYear ?? null),
      update: vi.fn().mockResolvedValue({ id: 21 }),
    },
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: options?.role ?? Role.DEPOSITEUR_COMPTABLE,
        soaId: options?.userSoaId === undefined ? 12 : options.userSoaId,
      }),
    },
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  return { service: new CompteMatieresService(prisma as never, {} as never), prisma, tx };
}

function makeCreateService(previousExercise: { id: number } | null) {
  const exercice = {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 25, annee: 2025 }),
    findFirst: vi.fn().mockResolvedValue(previousExercise),
  };
  const compteMatiere = {
    findUnique: vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 50, exerciceId: 25, details: [{ articleId: 4, existantDebut: new Prisma.Decimal('6.21') }] }),
    create: vi.fn().mockResolvedValue({ id: 50, exerciceId: 25 }),
  };
  const tx = { exercice, compteMatiere };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({
      id: 4,
      soaId: 12,
      role: Role.DEPOSITEUR_COMPTABLE,
    }) },
    sOA: { findUnique: vi.fn().mockResolvedValue({ id: 12 }) },
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  const mouvementService = {
    reporterStockDepuisExercicePrecedent: vi
      .fn()
      .mockResolvedValue(previousExercise ? { reporte: true } : { reporte: false }),
  };
  return {
    service: new CompteMatieresService(prisma as never, mouvementService as never),
    prisma,
    tx,
    mouvementService,
  };
}

describe('CompteMatieresService.create', () => {
  it('reporte automatiquement depuis le dernier exercice antérieur du même SOA dans la transaction de création', async () => {
    const { service, tx, prisma, mouvementService } = makeCreateService({ id: 14 });

    const result = await service.create({ annee: 2025 }, 4);

    expect(result).toMatchObject({
      id: 50,
      exerciceId: 25,
      details: [{ articleId: 4, existantDebut: new Prisma.Decimal('6.21') }],
    });
    expect(tx.compteMatiere.findUnique).toHaveBeenLastCalledWith({
      where: { id: 50 },
      include: {
        exercice: { include: { soa: true } },
        details: { include: { article: { include: { nomenclature: true } } } },
      },
    });
    expect(mouvementService.reporterStockDepuisExercicePrecedent).toHaveBeenCalledWith(
      25,
      4,
      tx,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('crée normalement le compte sans report quand aucun exercice antérieur existe', async () => {
    const { service, mouvementService } = makeCreateService(null);

    await service.create({ annee: 2025 }, 4);

    expect(mouvementService.reporterStockDepuisExercicePrecedent).toHaveBeenCalledTimes(1);
    await expect(
      mouvementService.reporterStockDepuisExercicePrecedent.mock.results[0].value,
    ).resolves.toEqual({ reporte: false });
  });
});

describe('CompteMatieresService.update', () => {
  it('corrige l’année d’un compte vide et met à jour les dates de l’exercice', async () => {
    const { service, tx } = makeService();

    await service.update(8, { annee: 2023 }, 4);

    expect(tx.exercice.update).toHaveBeenCalledWith({
      where: { id: 21 },
      data: {
        annee: 2023,
        dateDebut: new Date(Date.UTC(2023, 0, 1)),
        dateFin: new Date(Date.UTC(2023, 11, 31)),
      },
    });
  });

  it('refuse une année manquante, invalide ou courante', async () => {
    const { service, tx } = makeService();

    await expect(service.update(8, {} as never, 4)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(8, { annee: new Date().getFullYear() }, 4)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.exercice.update).not.toHaveBeenCalled();
  });

  it('refuse une année déjà utilisée dans le même SOA', async () => {
    const { service, tx } = makeService({ exerciseForYear: { id: 99 } });

    await expect(service.update(8, { annee: 2023 }, 4)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.exercice.update).not.toHaveBeenCalled();
  });

  it('refuse de modifier un compte inexistant ou appartenant à un autre SOA', async () => {
    const missing = makeService({ compte: null });
    await expect(missing.service.update(8, { annee: 2023 }, 4)).rejects.toBeInstanceOf(NotFoundException);

    const foreign = makeService({ userSoaId: 77 });
    await expect(foreign.service.update(8, { annee: 2023 }, 4)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuse la modification pour un rôle non autorisé', async () => {
    const { service, tx } = makeService({ role: Role.COMPTABLE });

    await expect(service.update(8, { annee: 2023 }, 4)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.compteMatiere.findUnique).not.toHaveBeenCalled();
  });

  it('refuse de changer l’année après création de détails, mouvements ou lots', async () => {
    const compteAvecDetails = emptyCompte();
    compteAvecDetails.details.push({ id: 1 });
    const details = makeService({ compte: compteAvecDetails });
    await expect(details.service.update(8, { annee: 2023 }, 4)).rejects.toBeInstanceOf(BadRequestException);

    const avecMouvements = emptyCompte();
    avecMouvements.exercice._count.mouvements = 1;
    const mouvements = makeService({ compte: avecMouvements });
    await expect(mouvements.service.update(8, { annee: 2023 }, 4)).rejects.toBeInstanceOf(BadRequestException);

    const avecLots = emptyCompte();
    avecLots.exercice._count.lotsStock = 1;
    const lots = makeService({ compte: avecLots });
    await expect(lots.service.update(8, { annee: 2023 }, 4)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CompteMatieresService.remove', () => {
  it('supprime un compte entièrement vide sans supprimer son exercice', async () => {
    const { service, tx } = makeService();

    await service.remove(8, 4);

    expect(tx.compteMatiere.delete).toHaveBeenCalledWith({ where: { id: 8 } });
    expect(tx.exercice.update).not.toHaveBeenCalled();
  });

  it('refuse la suppression d’un compte inexistant ou d’un autre SOA', async () => {
    const missing = makeService({ compte: null });
    await expect(missing.service.remove(8, 4)).rejects.toBeInstanceOf(NotFoundException);

    const foreign = makeService({ userSoaId: 77 });
    await expect(foreign.service.remove(8, 4)).rejects.toBeInstanceOf(NotFoundException);
    expect(foreign.tx.compteMatiere.delete).not.toHaveBeenCalled();
  });

  it('refuse la suppression si des détails, mouvements, lots ou montants existent', async () => {
    const details = emptyCompte();
    details.details.push({ id: 1 });
    const withDetails = makeService({ compte: details });
    await expect(withDetails.service.remove(8, 4)).rejects.toBeInstanceOf(BadRequestException);

    const movementCompte = emptyCompte();
    movementCompte.exercice._count.mouvements = 1;
    const withMovement = makeService({ compte: movementCompte });
    await expect(withMovement.service.remove(8, 4)).rejects.toBeInstanceOf(BadRequestException);

    const lotCompte = emptyCompte();
    lotCompte.exercice._count.lotsStock = 1;
    const withLots = makeService({ compte: lotCompte });
    await expect(withLots.service.remove(8, 4)).rejects.toBeInstanceOf(BadRequestException);

    const valueCompte = emptyCompte();
    valueCompte.valeurRestante = new Prisma.Decimal(1);
    const withValue = makeService({ compte: valueCompte });
    await expect(withValue.service.remove(8, 4)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse la suppression pour un rôle non autorisé', async () => {
    const { service, tx } = makeService({ role: Role.COMPTABLE });

    await expect(service.remove(8, 4)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.compteMatiere.findUnique).not.toHaveBeenCalled();
  });
});

