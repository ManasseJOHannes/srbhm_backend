import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InventaireService } from './inventaire.service.js';

const depositaire = { role: 'DEPOSITEUR_COMPTABLE', soaId: 12 };
const exercice = {
  id: 5,
  annee: 2025,
  soaId: 12,
  statut: 'EN_COURS',
  dateDebut: new Date(Date.UTC(2025, 0, 1)),
  dateFin: new Date(Date.UTC(2025, 11, 31)),
  soa: { id: 12 },
  compteMatiere: {
    details: [
      {
        id: 3,
        articleId: 3,
        prixUnitaire: 100,
        existantDebut: 10,
        entrees: 4,
        sorties: 2,
        folioGrandLivre: 12,
        observation: 'Bon état',
        observationEtat: 'Bon état',
        article: {
          designation: 'Chaise',
          unite: 'pièce',
          nomenclature: { code: '03', libelle: 'Meubles' },
          paragraphe: {
            code: '2164',
            article: { article: '216', chapitre: { chapitre: '21' } },
          },
        },
      },
      {
        id: 4,
        articleId: 4,
        prixUnitaire: 50,
        existantDebut: 5,
        entrees: 0,
        sorties: 1,
        folioGrandLivre: null,
        observation: null,
        observationEtat: 'Bon état',
        article: {
          designation: 'Table',
          unite: 'pièce',
          nomenclature: { code: '03', libelle: 'Meubles' },
          paragraphe: {
            code: '2163',
            article: { article: '216', chapitre: { chapitre: '21' } },
          },
        },
      },
    ],
  },
  mouvements: [
    { type: 'SORTIE', articleId: 3, prixUnitaire: 100, quantite: 1, observation: 'Facture N°200' },
    { type: 'SORTIE', articleId: 3, prixUnitaire: 100, quantite: 1, observation: 'Facture N°200' },
    { type: 'SORTIE', articleId: 3, prixUnitaire: 100, quantite: 0, observation: null },
  ],
  inventaire: null,
};

function makeService() {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 4, ...depositaire }) },
    exercice: {
      findUnique: vi.fn().mockResolvedValue(exercice),
      findMany: vi.fn().mockResolvedValue([exercice]),
    },
    mouvement: { findMany: vi.fn().mockResolvedValue([]) },
    detailCompteMatiere: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { service: new InventaireService(prisma as never), prisma };
}

function makeServiceTransaction(
  options: {
    compte?: { id: number } | null;
    detail?: Record<string, unknown> | null;
    ligne?: Record<string, unknown> | null;
    mouvement?: Record<string, unknown> | null;
    lignes?: Record<string, unknown>[];
  } = {},
) {
  const compte =
    options.compte === undefined ? { id: 7 } : options.compte;
  const detail =
    options.detail === undefined
      ? {
          id: 3,
          articleId: 3,
          prixUnitaire: 100,
          existantDebut: 10,
          entrees: 4,
          sorties: 2,
          observationEtat: 'Bon état',
        }
      : options.detail;
  let detailCourant = detail;
  const tx = {
    compteMatiere: {
      findUnique: vi.fn().mockResolvedValue(compte),
      create: vi.fn().mockResolvedValue({ id: 7 }),
      update: vi.fn().mockResolvedValue({}),
    },
    inventaire: {
      upsert: vi.fn().mockResolvedValue({ id: 1, dateInventaire: new Date() }),
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
      delete: vi.fn().mockResolvedValue({}),
    },
    ligneInventaire: {
      findUnique: vi.fn().mockResolvedValue(options.ligne ?? null),
      findFirst: vi.fn().mockResolvedValue(options.ligne ?? null),
      findMany: vi.fn().mockResolvedValue(options.lignes ?? []),
      create: vi.fn().mockImplementation(({ data }) => ({
        id: 30,
        ...data,
      })),
      update: vi.fn().mockImplementation(({ data }) => ({
        ...(options.ligne ?? {}),
        ...data,
      })),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(1),
    },
    detailCompteMatiere: {
      findUnique: vi.fn().mockImplementation(() => detailCourant),
      create: vi.fn().mockImplementation(({ data }) => {
        detailCourant = {
          id: 3,
          ...data,
          entrees: 0,
          sorties: 0,
          observationEtat: 'Bon état',
        };
        return detailCourant;
      }),
      update: vi.fn().mockImplementation(({ data }) => {
        detailCourant = {
          ...(detailCourant ?? {}),
          ...data,
        };
        return detailCourant;
      }),
      delete: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockImplementation(() =>
        detailCourant ? [detailCourant] : [],
      ),
    },
    mouvement: {
      findUnique: vi.fn().mockResolvedValue(options.mouvement ?? null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 4, ...depositaire }) },
    exercice: {
      findUnique: vi.fn().mockResolvedValue(exercice),
      findMany: vi.fn().mockResolvedValue([exercice]),
    },
    article: { findUnique: vi.fn().mockResolvedValue({ id: 3 }) },
    $transaction: vi.fn().mockImplementation(async (callback) => callback(tx)),
  };
  return { service: new InventaireService(prisma as never), prisma, tx };
}

describe('InventaireService règles de gestion', () => {
  it('calcule le reste théorique et signale les écarts', async () => {
    const { service } = makeService();
    const snapshot = await service.obtenir(5, 4);
    expect(snapshot.lignes).toHaveLength(2);
    expect(snapshot.lignes[0]).toMatchObject({ resteTheorique: 12 });
    expect(snapshot.coherent).toBe(true);
    expect(snapshot.avertissements).toEqual([]);
  });

  it('expose folio, nomenclature et observations fusionnées triées', async () => {
    const { service } = makeService();
    const snapshot = await service.obtenir(5, 4);
    expect(snapshot.lignes[0]).toMatchObject({
      detailId: 3,
      folioGrandLivre: 12,
      nomenclatureCode: '03',
      nomenclatureLibelle: 'Meubles',
      chapitreCode: '21',
      articleCode: '216',
      paragrapheCode: '2164',
      observationEtat: 'Bon état',
      observations: ['Bon état', 'Facture N°200'],
    });
    expect(snapshot.lignes[1]).toMatchObject({ observations: [] });
    expect(snapshot.exercice).toMatchObject({ annee: 2025 });
    expect(snapshot.exercice.dateFin).toBeInstanceOf(Date);
  });

  it("ne signale pas un décompte physique identique à l'existant", async () => {
    const { service, prisma } = makeService();
    const avecDecompte = {
      ...exercice,
      inventaire: {
        id: 1,
        dateInventaire: new Date(),
        lignes: [
          {
            articleId: 3,
            prixUnitaire: 100,
            existantReference: 12,
            quantitePhysique: 12,
          },
        ],
      },
    };
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue(avecDecompte as never);
    vi.mocked(prisma.exercice.findMany).mockResolvedValue([avecDecompte] as never);
    const snapshot = await service.obtenir(5, 4);
    expect(snapshot.lignes[0].ecart).toBe(0);
    expect(snapshot.avertissements).toEqual([]);
    expect(snapshot.coherent).toBe(true);
  });

  it('détecte un écart de décompte physique', async () => {
    const { service, prisma } = makeService();
    const avecDecompte = {
      ...exercice,
      inventaire: {
        id: 1,
        dateInventaire: new Date(),
        lignes: [{ articleId: 3, prixUnitaire: 100, quantitePhysique: 9 }],
      },
    };
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue(avecDecompte as never);
    vi.mocked(prisma.exercice.findMany).mockResolvedValue([avecDecompte] as never);
    const snapshot = await service.obtenir(5, 4);
    expect(snapshot.coherent).toBe(false);
    expect(snapshot.lignes[0].ecart).toBe(-3);
    expect(snapshot.avertissements).toHaveLength(1);
  });

  it('ne signale pas un écart expliqué par un excédent ou un déficit', async () => {
    const { service, prisma } = makeService();
    const avecDecompte = {
      ...exercice,
      inventaire: {
        id: 1,
        dateInventaire: new Date(),
        lignes: [
          {
            articleId: 3,
            prixUnitaire: 100,
            existantReference: 12,
            quantitePhysique: 14,
            quantiteExcedent: 2,
            quantiteDeficit: null,
          },
        ],
      },
    };
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue(avecDecompte as never);
    vi.mocked(prisma.exercice.findMany).mockResolvedValue([avecDecompte] as never);
    const snapshot = await service.obtenir(5, 4);
    expect(snapshot.lignes[0].ecart).toBe(2);
    expect(snapshot.avertissements).toEqual([]);
    expect(snapshot.coherent).toBe(true);
  });

  it('refuse la saisie sur exercice clôturé (R3)', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue({
      ...exercice,
      statut: 'CLOTURE',
    } as never);
    await expect(
      service.enregistrer(5, 4, { dateInventaire: '2025-12-31', lignes: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("ne montre que l'exercice N (les N-n sont reportés en existant)", async () => {
    const { service } = makeService();
    const snapshot = await service.obtenir(5, 4);
    // 2 détails du compte de N, aucun cumul d'autres exercices.
    expect(snapshot.lignes).toHaveLength(2);
    expect(snapshot.lignes.every((ligne) => !('exerciceAnnee' in ligne))).toBe(true);
  });

  it('affiche une sortie de l’année (bon de sortie)', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue({
      ...exercice,
      mouvements: [
        // Bon de sortie 2025 sur le détail de l'exercice (prix 100).
        { type: 'SORTIE', articleId: 3, prixUnitaire: 100, quantite: 3, observation: 'bon de sortie123' },
      ],
    } as never);
    const snapshot = await service.obtenir(5, 4);
    const ligne = snapshot.lignes.find((item) => item.articleId === 3);
    expect(ligne).toMatchObject({ sorties: 3, resteTheorique: 11 });
    expect(ligne?.observations).toContain('bon de sortie123');
  });

  it('affiche les sorties de l’année sans reprises ni prélèvements', async () => {
    // R2 stricte : sorties cumulées ≤ existant, donc pas de négatif.
    const { service, prisma } = makeService();
    const avecFlux = {
      ...exercice,
      mouvements: [
        { type: 'SORTIE', articleId: 3, prixUnitaire: 100, quantite: 2, observation: 'bon 1' },
      ],
    };
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue(avecFlux as never);
    const snapshot = await service.obtenir(5, 4);
    expect(snapshot.lignes[0]).toMatchObject({
      sorties: 2,
      resteTheorique: 12,
    });
    expect(snapshot.lignes[0]).not.toHaveProperty('reprises');
    expect(snapshot.lignes[0]).not.toHaveProperty('preleveUlterieur');
  });

  it("met à jour l'état de la matière d'une ligne", async () => {
    const { service, prisma } = makeService();
    const result = await service.updateObservationEtat(5, 4, {
      detailId: 3,
      observationEtat: 'Mauvais état',
    });
    expect(result).toEqual({
      detailId: 3,
      observationEtat: 'Mauvais état',
    });
    expect(prisma.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { observationEtat: 'Mauvais état' },
    });
  });

  it("refuse la modification d'état par un comptable", async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 4,
      role: 'COMPTABLE',
      soaId: 12,
    } as never);
    await expect(
      service.updateObservationEtat(5, 4, {
        detailId: 3,
        observationEtat: 'Bon état',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse la modification d'état sur exercice clôturé", async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue({
      ...exercice,
      statut: 'CLOTURE',
    } as never);
    await expect(
      service.updateObservationEtat(5, 4, {
        detailId: 3,
        observationEtat: 'Bon état',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse un détail absent de l'exercice", async () => {
    const { service } = makeService();
    await expect(
      service.updateObservationEtat(5, 4, {
        detailId: 999,
        observationEtat: 'Bon état',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("crée une entrée de stock pour un excédent et fige l'existant", async () => {
    const { service, tx } = makeServiceTransaction();
    await service.upsertLigne(5, 4, {
      articleId: 3,
      prixUnitaire: 100,
      quantiteConstatee: 5,
      quantiteExcedent: 5,
      quantiteDeficit: null,
    });

    expect(tx.ligneInventaire.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          articleId: 3,
          quantitePhysique: 5,
          quantiteExcedent: 5,
          quantiteDeficit: null,
          existantReference: 12,
        }),
      }),
    );
    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { entrees: 9 },
    });
    expect(tx.mouvement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ENTREE',
          quantite: 5,
          origine: 'RECENSEMENT',
          ligneInventaireId: 30,
        }),
      }),
    );
    expect(tx.mouvement.delete).not.toHaveBeenCalled();
  });

  it("met à jour l'entrée existante sans doubler la quantité", async () => {
    const { service, tx } = makeServiceTransaction({
      ligne: {
        id: 30,
        articleId: 3,
        prixUnitaire: 100,
        quantitePhysique: 12,
        quantiteExcedent: 2,
        quantiteDeficit: null,
        existantReference: 12,
      },
      detail: {
        id: 3,
        articleId: 3,
        prixUnitaire: 100,
        existantDebut: 10,
        entrees: 6,
        sorties: 2,
        observationEtat: 'Bon état',
      },
      mouvement: { id: 99, quantite: 2, ligneInventaireId: 30 },
    });

    await service.upsertLigne(5, 4, {
      articleId: 3,
      prixUnitaire: 100,
      quantiteConstatee: 12,
      quantiteExcedent: 5,
      quantiteDeficit: null,
    });

    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { entrees: 9 },
    });
    expect(tx.mouvement.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({ quantite: 5 }),
    });
    expect(tx.mouvement.create).not.toHaveBeenCalled();
  });

  it("supprime l'entrée quand l'excédent redevient nul", async () => {
    const { service, tx } = makeServiceTransaction({
      ligne: {
        id: 30,
        articleId: 3,
        prixUnitaire: 100,
        quantitePhysique: 12,
        quantiteExcedent: 2,
        quantiteDeficit: null,
        existantReference: 12,
      },
      detail: {
        id: 3,
        articleId: 3,
        prixUnitaire: 100,
        existantDebut: 10,
        entrees: 6,
        sorties: 2,
        observationEtat: 'Bon état',
      },
      mouvement: { id: 99, quantite: 2, ligneInventaireId: 30 },
    });

    await service.upsertLigne(5, 4, {
      articleId: 3,
      prixUnitaire: 100,
      quantiteConstatee: 12,
      quantiteExcedent: null,
      quantiteDeficit: null,
    });

    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { entrees: 4 },
    });
    expect(tx.mouvement.delete).toHaveBeenCalledWith({ where: { id: 99 } });
  });

  it("ne crée aucun mouvement de sortie pour un déficit", async () => {
    const { service, tx } = makeServiceTransaction();
    await service.upsertLigne(5, 4, {
      articleId: 3,
      prixUnitaire: 100,
      quantiteConstatee: 6,
      quantiteExcedent: null,
      quantiteDeficit: 2,
    });

    expect(tx.ligneInventaire.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantitePhysique: 6,
          quantiteExcedent: null,
          quantiteDeficit: 2,
        }),
      }),
    );
    expect(tx.mouvement.create).not.toHaveBeenCalled();
    expect(tx.detailCompteMatiere.update).not.toHaveBeenCalled();
  });

  it("crée le compte et le détail pour un article absent", async () => {
    const { service, tx } = makeServiceTransaction({
      compte: null,
      detail: null,
    });
    await service.upsertLigne(5, 4, {
      articleId: 3,
      prixUnitaire: 100,
      quantiteConstatee: 4,
      quantiteExcedent: 4,
      quantiteDeficit: null,
      observationEtat: 'Mauvais état',
    });

    expect(tx.compteMatiere.create).toHaveBeenCalledWith({
      data: { exerciceId: 5 },
    });
    expect(tx.detailCompteMatiere.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          compteMatiereId: 7,
          articleId: 3,
          existantDebut: 0,
        }),
      }),
    );
    expect(tx.ligneInventaire.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ existantReference: 0 }),
      }),
    );
    expect(tx.mouvement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ENTREE',
          quantite: 4,
          origine: 'RECENSEMENT',
        }),
      }),
    );
  });

  it("supprime la ligne et annule son entrée", async () => {
    const { service, tx } = makeServiceTransaction({
      ligne: {
        id: 30,
        articleId: 3,
        prixUnitaire: 100,
        quantitePhysique: 12,
        quantiteExcedent: 2,
        quantiteDeficit: null,
        existantReference: 12,
      },
      detail: {
        id: 3,
        articleId: 3,
        prixUnitaire: 100,
        existantDebut: 10,
        entrees: 6,
        sorties: 2,
        observationEtat: 'Bon état',
      },
      mouvement: { id: 99, quantite: 2, ligneInventaireId: 30 },
    });

    await service.supprimerLigne(5, 4, 30);

    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { entrees: 4 },
    });
    expect(tx.mouvement.delete).toHaveBeenCalledWith({ where: { id: 99 } });
    expect(tx.ligneInventaire.delete).toHaveBeenCalledWith({
      where: { id: 30 },
    });
  });

  it("supprime le détail créé par le recensement lorsqu'il redevient vide", async () => {
    const { service, tx } = makeServiceTransaction({
      ligne: {
        id: 31,
        articleId: 3,
        prixUnitaire: 100,
        quantitePhysique: 2,
        quantiteExcedent: 2,
        quantiteDeficit: null,
        existantReference: 0,
      },
      detail: {
        id: 9,
        articleId: 3,
        prixUnitaire: 100,
        existantDebut: 0,
        entrees: 2,
        sorties: 0,
        folioGrandLivre: null,
        observation: null,
        observationEtat: 'Bon état',
        creeParRecensement: true,
      },
      mouvement: { id: 100, quantite: 2, ligneInventaireId: 31 },
    });

    await service.supprimerLigne(5, 4, 31);

    expect(tx.detailCompteMatiere.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { entrees: 0 },
    });
    expect(tx.detailCompteMatiere.delete).toHaveBeenCalledWith({
      where: { id: 9 },
    });
  });

  it("interdit la saisie des quantités à un comptable", async () => {
    const { service, prisma } = makeServiceTransaction();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 4,
      role: 'COMPTABLE',
      soaId: 12,
    } as never);
    await expect(
      service.upsertLigne(5, 4, {
        articleId: 3,
        prixUnitaire: 100,
        quantiteConstatee: 10,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("interdit la saisie des quantités sur un exercice clôturé", async () => {
    const { service, prisma } = makeServiceTransaction();
    vi.mocked(prisma.exercice.findUnique).mockResolvedValue({
      ...exercice,
      statut: 'CLOTURE',
    } as never);
    await expect(
      service.upsertLigne(5, 4, {
        articleId: 3,
        prixUnitaire: 100,
        quantiteConstatee: 10,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
