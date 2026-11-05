import { describe, expect, it, vi } from 'vitest';

import { JournalAuditService } from './journal-audit.service.js';

function creerPrisma() {
  return {
    user: { findUnique: vi.fn() },
    journalAudit: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe('JournalAuditService', () => {
  it("enregistre l'action avec le nom de l'auteur", async () => {
    const prisma = creerPrisma();
    prisma.user.findUnique.mockResolvedValue({
      nom: 'Rakoto',
      prenom: 'Jean',
      imatricule: 'EMP-0001',
    });
    prisma.journalAudit.create.mockResolvedValue({});
    const service = new JournalAuditService(prisma as never);

    await service.enregistrer({
      action: 'TEST',
      auteurId: 7,
      details: 'Action de test',
      ip: '127.0.0.1',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { nom: true, prenom: true, imatricule: true },
    });
    expect(prisma.journalAudit.create).toHaveBeenCalledWith({
      data: {
        action: 'TEST',
        entite: null,
        entiteId: null,
        auteurId: 7,
        auteurNom: 'Jean Rakoto (EMP-0001)',
        details: 'Action de test',
        ip: '127.0.0.1',
      },
    });
  });

  it("n'échoue jamais si l'écriture du journal échoue", async () => {
    const prisma = creerPrisma();
    prisma.journalAudit.create.mockRejectedValue(new Error('base indisponible'));
    const service = new JournalAuditService(prisma as never);

    await expect(
      service.enregistrer({ action: 'TEST' }),
    ).resolves.toBeUndefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('filtre et pagine la consultation', async () => {
    const prisma = creerPrisma();
    prisma.journalAudit.findMany.mockResolvedValue([]);
    prisma.journalAudit.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(
      async (operations: Promise<unknown>[]) => Promise.all(operations),
    );
    const service = new JournalAuditService(prisma as never);

    const resultat = await service.lister({
      page: 2,
      taille: 10,
      auteurId: 7,
      action: 'CONNEXION',
      dateDebut: '2026-11-01',
      dateFin: '2026-11-05',
    });

    expect(prisma.journalAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          auteurId: 7,
          action: 'CONNEXION',
          createdAt: expect.objectContaining({
            gte: new Date('2026-11-01T00:00:00.000Z'),
            lte: new Date('2026-11-05T23:59:59.999Z'),
          }),
        }),
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      }),
    );
    expect(resultat).toEqual({ items: [], total: 0, page: 2, taille: 10 });
  });
});
