import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from './../src/app.module.js';
import { InventaireService } from './../src/inventaire/inventaire.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Régression du 500 sur GET /inventaires/exercices/:id.
 * Cause racine : les tables "Inventaire" / "LigneInventaire" n'existaient
 * pas en base (migration 20261012160000_add_inventaire non appliquée),
 * donc l'include `inventaire: { include: { lignes: true } }` levait P2021.
 */
describe('Inventaire (e2e)', () => {
  let app: INestApplication;
  let inventaire: InventaireService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    inventaire = moduleFixture.get(InventaireService);
    prisma = moduleFixture.get(PrismaService);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('les tables Inventaire et LigneInventaire existent en base', async () => {
    const rows = (await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('Inventaire', 'LigneInventaire')`) as Array<{
      table_name: string;
    }>;
    expect(rows.map((r) => r.table_name).sort()).toEqual([
      'Inventaire',
      'LigneInventaire',
    ]);
  });

  it('obtenir() ne lève pas de 500 sur un exercice réel (include inventaire + lignes)', async () => {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    const exercice = await prisma.exercice.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true, soaId: true },
    });
    expect(admin).not.toBeNull();
    expect(exercice).not.toBeNull();

    const result = await inventaire.obtenir(exercice!.id, admin!.id);
    expect(result.exercice.id).toBe(exercice!.id);
    expect(Array.isArray(result.lignes)).toBe(true);
  });

  it('tous les exercices ont des dates dans leur année (garde-fou 400 inventaire)', async () => {
    const exercices = await prisma.exercice.findMany({
      select: { id: true, annee: true, dateDebut: true, dateFin: true },
    });
    expect(exercices.length).toBeGreaterThan(0);
    for (const exo of exercices) {
      expect(
        new Date(exo.dateDebut).getUTCFullYear(),
        `exercice ${exo.id} : dateDebut hors année ${exo.annee}`,
      ).toBe(exo.annee);
      expect(
        new Date(exo.dateFin).getUTCFullYear(),
        `exercice ${exo.id} : dateFin hors année ${exo.annee}`,
      ).toBe(exo.annee);
    }
  });

  it('GET exercice 3 (ex-400 date incohérente) répond 200 avec des lignes', async () => {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    expect(admin).not.toBeNull();

    const result = await inventaire.obtenir(3, admin!.id);
    expect(result.exercice.id).toBe(3);
    expect(Array.isArray(result.lignes)).toBe(true);
  });

  it.each([2001, 2024, 2025, 2026])(
    'obtenir() sans date répond 200 pour l’exercice %i (date de référence automatique)',
    async (annee) => {
      const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      const exercice = await prisma.exercice.findFirst({
        where: { annee },
        select: { id: true },
      });
      expect(admin).not.toBeNull();
      expect(exercice).not.toBeNull();

      const result = await inventaire.obtenir(exercice!.id, admin!.id);
      expect(result.exercice.annee).toBe(annee);
      expect(Array.isArray(result.lignes)).toBe(true);
      expect(result.dateInventaire).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );

  it('observationDetail correspond au détail du compte-matières du bon exercice (données réelles)', async () => {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    const compte = await prisma.compteMatiere.findUnique({
      where: { exerciceId: 3 },
      include: {
        details: { select: { articleId: true, prixUnitaire: true, observation: true } },
      },
    });
    expect(admin).not.toBeNull();
    expect(compte).not.toBeNull();
    expect(compte!.details.length).toBeGreaterThan(0);

    const result = await inventaire.obtenir(3, admin!.id);
    expect(result.exercice.id).toBe(3);
    for (const detail of compte!.details) {
      const expectedKey = `${detail.articleId}:${new Prisma.Decimal(detail.prixUnitaire).toFixed(2)}`;
      const line = result.lignes.find(
        (l) => `${l.articleId}:${new Prisma.Decimal(l.prixUnitaire).toFixed(2)}` === expectedKey,
      );
      expect(line, `ligne article ${detail.articleId}`).toBeDefined();
      expect(line!.observationDetail).toBe(detail.observation);
    }
  });

  it.each([14, 15, 1])(
    'exercice %i : observationDetail = observation du détail de SON propre compte (jamais un autre exercice)',
    async (exerciceId) => {
      const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      expect(admin).not.toBeNull();

      const compte = await prisma.compteMatiere.findUnique({
        where: { exerciceId },
        include: {
          details: { select: { articleId: true, prixUnitaire: true, observation: true } },
        },
      });
      const ownByKey = new Map(
        (compte?.details ?? []).map((d) => [
          `${d.articleId}:${new Prisma.Decimal(d.prixUnitaire).toFixed(2)}`,
          d.observation,
        ]),
      );

      const result = await inventaire.obtenir(exerciceId, admin!.id);
      expect(result.exercice.id).toBe(exerciceId);
      expect(result.lignes.length).toBeGreaterThan(0);
      for (const line of result.lignes) {
        const key = `${line.articleId}:${new Prisma.Decimal(line.prixUnitaire).toFixed(2)}`;
        // Absente => null (l'UI affiche « — »), jamais celle d'un autre exercice.
        expect(line.observationDetail).toBe(ownByKey.get(key) ?? null);
      }
    },
  );

  it('observationsLots suit les lots d’origine sur données réelles (exercice 2)', async () => {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    expect(admin).not.toBeNull();

    const result = await inventaire.obtenir(2, admin!.id);
    const parCle = new Map(
      result.lignes.map((l) => [
        `${l.articleId}:${new Prisma.Decimal(l.prixUnitaire).toFixed(2)}`,
        l,
      ]),
    );
    // Lots d'entrée 3 et 4 portent les observations de leurs mouvements.
    expect(parCle.get('2:760000.00')?.observationsLots).toEqual(['Facture achat N°123']);
    expect(parCle.get('2:159000000.00')?.observationsLots).toEqual(['Facture achat N°200']);
    // Lots initiaux sans source : aucune observation inventée, repli sur le détail (ici absent aussi).
    expect(parCle.get('1:159000.00')?.observationsLots).toEqual([]);
    expect(parCle.get('1:159000.00')?.observationDetail).toBeNull();
  });

  it("un dépositaire d'un autre SOA reçoit 404, pas 500", async () => {
    const exercice = await prisma.exercice.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true, soaId: true },
    });
    const outsider = await prisma.user.findFirst({
      where: { role: 'DEPOSITEUR_COMPTABLE', soaId: { not: exercice!.soaId } },
      select: { id: true },
    });
    expect(exercice).not.toBeNull();
    expect(outsider).not.toBeNull();

    await expect(inventaire.obtenir(exercice!.id, outsider!.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
