import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { InventaireService } from './inventaire.service.js';

const article = {
  id: 4,
  designation: 'Table ronde',
  unite: 'U',
  nomenclature: { code: 'MOB', libelle: 'Mobilier' },
};

function exerciceData() {
  return {
    id: 13,
    annee: 2003,
    soaId: 2,
    dateDebut: new Date('2003-01-01T00:00:00.000Z'),
    dateFin: new Date('2003-12-31T00:00:00.000Z'),
    statut: 'EN_COURS',
    soa: { id: 2, code: 'SOA2', libelle: 'Budget' },
    compteMatiere: {
      details: [{
        id: 8,
        articleId: 4,
        folioGrandLivre: 2,
        prixUnitaire: new Prisma.Decimal('400000'),
        existantDebut: new Prisma.Decimal('6.21'),
        entrees: new Prisma.Decimal('0'),
        sorties: new Prisma.Decimal('0'),
        observation: 'OE N° 02/96',
        article,
      }],
    },
    lotsStock: [{
      id: 21,
      articleId: 4,
      prixUnitaire: new Prisma.Decimal('400000'),
      typeOrigine: 'STOCK_INITIAL',
      lotParentId: 12,
      detailCompteMatiereId: 8,
      dateOrigine: new Date('2003-01-01T00:00:00.000Z'),
      quantiteInitiale: new Prisma.Decimal('6.21'),
      quantiteRestante: new Prisma.Decimal('6.21'),
      article,
      affectations: [],
      observation: null,
    }],
    mouvements: [],
    inventaire: null,
  };
}

function makeService(role: Role = Role.DEPOSITEUR_COMPTABLE, soaId: number | null = 2) {
  const exercise = exerciceData();
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 5, role, soaId }) },
    exercice: { findUnique: vi.fn().mockResolvedValue(exercise) },
    article: { findUnique: vi.fn() },
    lotStock: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  };
  return { service: new InventaireService(prisma as never), prisma, exercise };
}

describe('InventaireService', () => {
  it('calcule reste théorique et écart physique avec les décimales sans modifier le stock', async () => {
    const { service } = makeService();
    const result = await service.obtenir(13, 5, '2003-12-31');
    expect(result.lignes[0]).toMatchObject({
      existantDebut: '6.21',
      entrees: '0',
      sorties: '0',
      resteTheorique: '6.21',
      quantiteLots: '6.21',
      valeurTheorique: '2484000',
      decomptePhysique: null,
      ecart: null,
    });
  });

  it('utilise la date de fin d’exercice sans paramètre de date', async () => {
    const { service } = makeService();
    const result = await service.obtenir(13, 5);
    expect(result.dateInventaire).toBe('2003-12-31');
  });

  it('remonte l’observation du compte-matières sur chaque ligne', async () => {
    const { service } = makeService();
    const result = await service.obtenir(13, 5, '2003-12-31');
    expect(result.lignes[0]).toMatchObject({ observationDetail: 'OE N° 02/96' });
  });

  it('retourne null quand le détail ne porte aucune observation', async () => {
    const { service, exercise } = makeService();
    Reflect.set(exercise.compteMatiere.details[0], 'observation', null);
    const result = await service.obtenir(13, 5, '2003-12-31');
    expect(result.lignes[0]).toMatchObject({ observationDetail: null });
  });

  it('ne remplace pas l’observation du compte par celle saisie dans l’inventaire', async () => {
    const { service, exercise } = makeService();
    Reflect.set(exercise, 'inventaire', {
      id: 90,
      exerciceId: 13,
      dateInventaire: new Date('2003-12-31T00:00:00.000Z'),
      createdAt: new Date('2003-12-31T00:00:00.000Z'),
      updatedAt: new Date('2003-12-31T00:00:00.000Z'),
      lignes: [{
        id: 92,
        inventaireId: 90,
        articleId: 4,
        prixUnitaire: new Prisma.Decimal('400000'),
        quantitePhysique: new Prisma.Decimal('6.20'),
        observation: 'Saisie manuelle',
        createdAt: new Date('2003-12-31T00:00:00.000Z'),
        updatedAt: new Date('2003-12-31T00:00:00.000Z'),
      }],
    });
    const result = await service.obtenir(13, 5, '2003-12-31');
    expect(result.lignes[0]).toMatchObject({
      observationDetail: 'OE N° 02/96',
      observation: 'Saisie manuelle',
    });
  });

  it('scénarios B/C/E : deux lots d’un même article conservent leurs observations distinctes, même partiellement consommés', async () => {
    const { service, prisma, exercise } = makeService();
    // Lot enfant sans observation propre : hérite du parent 12 via la chaîne.
    prisma.lotStock.findMany.mockResolvedValue([
      {
        id: 12,
        lotParentId: null,
        observation: 'Achat initial 2000',
        exercice: { soaId: 2 },
      },
    ]);
    // Second lot indépendant (don), partiellement consommé : sa propre observation reste accessible.
    Reflect.set(exercise.lotsStock, exercise.lotsStock.length, {
      id: 23,
      articleId: 4,
      prixUnitaire: new Prisma.Decimal('400000'),
      typeOrigine: 'ENTREE',
      lotParentId: null,
      detailCompteMatiereId: null,
      dateOrigine: new Date('2003-02-01T00:00:00.000Z'),
      quantiteInitiale: new Prisma.Decimal('2'),
      quantiteRestante: new Prisma.Decimal('1'),
      article,
      affectations: [],
      observation: 'Don reçu en 2026',
    });
    const result = await service.obtenir(13, 5, '2003-12-31');
    expect(result.lignes[0].observationsLots).toEqual([
      'Achat initial 2000',
      'Don reçu en 2026',
    ]);
  });

  it('expose les observations des mouvements de l’exercice courant, distinctes et filtrées par date', async () => {
    const { service, exercise } = makeService();
    Reflect.set(exercise, 'mouvements', [
      {
        id: 41,
        exerciceId: 13,
        articleId: 4,
        prixUnitaire: new Prisma.Decimal('400000'),
        quantite: new Prisma.Decimal('5'),
        type: 'ENTREE',
        date: new Date('2003-03-15T00:00:00.000Z'),
        observation: 'Facture achat N°123',
        article,
        affectationsSortie: [],
        lotStockCree: null,
      },
      {
        id: 42,
        exerciceId: 13,
        articleId: 4,
        prixUnitaire: new Prisma.Decimal('400000'),
        quantite: new Prisma.Decimal('1'),
        type: 'SORTIE',
        date: new Date('2003-03-15T00:00:00.000Z'),
        observation: 'Facture achat N°123',
        article,
        affectationsSortie: [],
        lotStockCree: null,
      },
      {
        id: 43,
        exerciceId: 13,
        articleId: 4,
        prixUnitaire: new Prisma.Decimal('400000'),
        quantite: new Prisma.Decimal('2'),
        type: 'ENTREE',
        date: new Date('2003-06-01T00:00:00.000Z'),
        observation: '  ',
        article,
        affectationsSortie: [],
        lotStockCree: null,
      },
      {
        id: 44,
        exerciceId: 13,
        articleId: 4,
        prixUnitaire: new Prisma.Decimal('400000'),
        quantite: new Prisma.Decimal('1'),
        type: 'ENTREE',
        date: new Date('2004-01-05T00:00:00.000Z'),
        observation: 'Facture future à exclure',
        article,
        affectationsSortie: [],
        lotStockCree: null,
      },
    ]);
    const result = await service.obtenir(13, 5, '2003-12-31');
    expect(result.lignes[0].observationsMouvements).toEqual(['Facture achat N°123']);
  });

  it('retourne une liste vide quand aucun mouvement ne porte d’observation', async () => {
    const { service } = makeService();
    const result = await service.obtenir(13, 5, '2003-12-31');
    expect(result.lignes[0].observationsMouvements).toEqual([]);
  });

  it('expose la date de référence au format AAAA-MM-JJ', async () => {
    const { service } = makeService();
    const result = await service.obtenir(13, 5, '2003-12-31');
    expect(result.dateInventaire).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('déduit les sorties affectées une seule fois et compare le solde FIFO aux lots', async () => {
    const { service, exercise } = makeService();
    exercise.compteMatiere.details[0].entrees = new Prisma.Decimal('1');
    exercise.compteMatiere.details[0].sorties = new Prisma.Decimal('0.79');
    Reflect.set(exercise.lotsStock, exercise.lotsStock.length, {
      id: 22,
      articleId: 4,
      prixUnitaire: new Prisma.Decimal('400000'),
      typeOrigine: 'ENTREE',
      lotParentId: null,
      detailCompteMatiereId: null,
      dateOrigine: new Date('2003-02-01T00:00:00.000Z'),
      quantiteInitiale: new Prisma.Decimal('1'),
      quantiteRestante: new Prisma.Decimal('1'),
      article,
      affectations: [],
      observation: null,
    });
    Reflect.set(exercise, 'mouvements', [
      {
        id: 31,
        exerciceId: 13,
        articleId: 4,
        prixUnitaire: new Prisma.Decimal('400000'),
        quantite: new Prisma.Decimal('1'),
        type: 'ENTREE',
        date: new Date('2003-02-01T00:00:00.000Z'),
        article,
        affectationsSortie: [],
        lotStockCree: null,
      },
      {
        id: 32,
        exerciceId: 13,
        articleId: 4,
        prixUnitaire: new Prisma.Decimal('400000'),
        quantite: new Prisma.Decimal('0.79'),
        type: 'SORTIE',
        date: new Date('2003-03-01T00:00:00.000Z'),
        article,
        affectationsSortie: [{
          quantite: new Prisma.Decimal('0.79'),
          lotStock: {
            id: 21,
            exerciceId: 13,
            articleId: 4,
            prixUnitaire: new Prisma.Decimal('400000'),
            dateOrigine: new Date('2003-01-01T00:00:00.000Z'),
          },
        }],
        lotStockCree: null,
      },
    ]);
    exercise.lotsStock[0].quantiteRestante = new Prisma.Decimal('5.42');
    const result = await service.obtenir(13, 5, '2003-12-31');
    expect(result.lignes[0]).toMatchObject({
      existantDebut: '6.21',
      entrees: '1',
      sorties: '0.79',
      resteTheorique: '6.42',
      quantiteLots: '6.42',
      avertissements: [],
    });
  });

  it('calcule un écart physique négatif à deux décimales', async () => {
    const { service, exercise } = makeService();
    Reflect.set(exercise, 'inventaire', {
      id: 90,
      exerciceId: 13,
      dateInventaire: new Date('2003-12-31T00:00:00.000Z'),
      createdAt: new Date('2003-12-31T00:00:00.000Z'),
      updatedAt: new Date('2003-12-31T00:00:00.000Z'),
      lignes: [{
        id: 92,
        inventaireId: 90,
        articleId: 4,
        prixUnitaire: new Prisma.Decimal('400000'),
        quantitePhysique: new Prisma.Decimal('6.20'),
        observation: 'Compté',
        createdAt: new Date('2003-12-31T00:00:00.000Z'),
        updatedAt: new Date('2003-12-31T00:00:00.000Z'),
      }],
    });
    const result = await service.obtenir(13, 5);
    expect(result.lignes[0]).toMatchObject({ decomptePhysique: '6.2', ecart: '-0.01' });
  });

  it('refuse à un dépositaire de consulter un exercice d’un autre SOA', async () => {
    const { service } = makeService(Role.DEPOSITEUR_COMPTABLE, 99);
    await expect(service.obtenir(13, 5)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuse à un COMPTABLE de saisir le décompte physique', async () => {
    const { service, prisma } = makeService(Role.COMPTABLE);
    await expect(service.enregistrer(13, 5, {
      dateInventaire: '2003-12-31',
      lignes: [],
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('enregistre les comptages par article et prix via upsert, de façon répétable', async () => {
    const { service, prisma } = makeService();
    const tx = {
      exercice: { findUnique: vi.fn().mockResolvedValue({ id: 13, annee: 2003 }) },
      detailCompteMatiere: { findMany: vi.fn().mockResolvedValue([{ articleId: 4, prixUnitaire: new Prisma.Decimal('400000') }]) },
      lotStock: { findMany: vi.fn().mockResolvedValue([]) },
      mouvement: { findMany: vi.fn().mockResolvedValue([]) },
      inventaire: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 6 }),
      },
      ligneInventaire: { upsert: vi.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const input = {
      dateInventaire: '2003-12-31',
      lignes: [{ articleId: 4, prixUnitaire: '400000', quantitePhysique: '6.20' }],
    };
    await service.enregistrer(13, 5, input);
    await service.enregistrer(13, 5, input);

    expect(tx.inventaire.upsert).toHaveBeenCalledTimes(2);
    expect(tx.ligneInventaire.upsert).toHaveBeenCalledTimes(2);
    expect(tx.ligneInventaire.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ quantitePhysique: new Prisma.Decimal('6.20') }),
      update: expect.objectContaining({ quantitePhysique: new Prisma.Decimal('6.20') }),
    }));
  });
});
