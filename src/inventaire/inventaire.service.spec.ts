import { ForbiddenException } from '@nestjs/common';
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
        articleId: 3,
        prixUnitaire: 100,
        existantDebut: 10,
        entrees: 4,
        sorties: 2,
        folioGrandLivre: 12,
        observation: 'Bon état',
        article: {
          designation: 'Chaise',
          unite: 'pièce',
          nomenclature: { code: '03', libelle: 'Meubles' },
        },
      },
      {
        articleId: 4,
        prixUnitaire: 50,
        existantDebut: 5,
        entrees: 0,
        sorties: 1,
        folioGrandLivre: null,
        observation: null,
        article: {
          designation: 'Table',
          unite: 'pièce',
          nomenclature: { code: '03', libelle: 'Meubles' },
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
  };
  return { service: new InventaireService(prisma as never), prisma };
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
      folioGrandLivre: 12,
      nomenclatureCode: '03',
      nomenclatureLibelle: 'Meubles',
      observations: ['Bon état', 'Facture N°200'],
    });
    expect(snapshot.lignes[1]).toMatchObject({ observations: [] });
    expect(snapshot.exercice).toMatchObject({ annee: 2025 });
    expect(snapshot.exercice.dateFin).toBeInstanceOf(Date);
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
});
