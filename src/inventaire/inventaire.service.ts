import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { normaliserTexteObservation, observationOrigineChaine } from '../observations-stock/observation-stock.helper.js';
import { SaveInventaireDto } from './dto/save-inventaire.dto.js';

const STOCK_ROLES: Role[] = [
  Role.ADMIN,
  Role.COMPTABLE,
  Role.DEPOSITEUR_COMPTABLE,
];

function stockKey(articleId: number, price: Prisma.Decimal) {
  return `${articleId}:${price.toFixed(2)}`;
}

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseInventoryDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new BadRequestException('Date d’inventaire invalide');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (dayString(date) !== value) {
    throw new BadRequestException('Date d’inventaire invalide');
  }
  const cutoff = new Date(date);
  cutoff.setUTCHours(23, 59, 59, 999);
  return { date, cutoff };
}

type ArticleStock = {
  id: number;
  designation: string;
  unite: string;
  nomenclature: { code: string; libelle: string };
};

type DetailStock = {
  id: number;
  articleId: number;
  folioGrandLivre: number | null;
  prixUnitaire: Prisma.Decimal;
  existantDebut: Prisma.Decimal;
  entrees: Prisma.Decimal;
  sorties: Prisma.Decimal;
  observation: string | null;
  article: ArticleStock;
};

type SavedInventoryLine = {
  articleId: number;
  prixUnitaire: Prisma.Decimal;
  quantitePhysique: Prisma.Decimal;
  observation: string | null;
};

@Injectable()
export class InventaireService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifierAcces(exerciceId: number, userId: number, write = false) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!STOCK_ROLES.includes(user.role)) {
      throw new ForbiddenException('Accès à l’inventaire refusé');
    }
    if (write && user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new ForbiddenException(
        'Seul le Dépositaire Comptable peut saisir le décompte physique',
      );
    }

    const exercice = await this.prisma.exercice.findUnique({
      where: { id: exerciceId },
      select: { id: true, soaId: true },
    });
    if (!exercice) throw new NotFoundException('Exercice introuvable');
    if (
      user.role === Role.DEPOSITEUR_COMPTABLE &&
      user.soaId !== exercice.soaId
    ) {
      throw new NotFoundException('Exercice introuvable');
    }
    return { user, exercice };
  }

  async obtenir(exerciceId: number, userId: number, dateDemandee?: string) {
    const { exercice: acces } = await this.verifierAcces(exerciceId, userId);
    const exercice = await this.prisma.exercice.findUnique({
      where: { id: acces.id },
      include: {
        soa: true,
        compteMatiere: {
          include: {
            details: {
              include: {
                article: { include: { nomenclature: true } },
              },
              orderBy: [
                { article: { nomenclature: { code: 'asc' } } },
                { article: { designation: 'asc' } },
                { prixUnitaire: 'asc' },
              ],
            },
          },
        },
        lotsStock: {
          include: {
            article: { include: { nomenclature: true } },
            affectations: {
              include: { mouvementSortie: true },
            },
          },
          orderBy: [{ dateOrigine: 'asc' }, { id: 'asc' }],
        },
        mouvements: {
          include: {
            article: { include: { nomenclature: true } },
            affectationsSortie: { include: { lotStock: true } },
            lotStockCree: true,
          },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        },
        inventaire: { include: { lignes: true } },
      },
    });
    if (!exercice) throw new NotFoundException('Exercice introuvable');

    // Index des lots connus : exercice sélectionné + ancêtres des reports.
    // Les lots parents vivent dans des exercices antérieurs ; on les charge
    // en restant cloisonné au SOA de l'exercice sélectionné.
    const lotsParId = new Map<
      number,
      { id: number; lotParentId: number | null; observation: string | null }
    >();
    for (const lot of exercice.lotsStock) {
      lotsParId.set(lot.id, lot);
    }
    const parentsACharger = new Set<number>();
    for (const lot of exercice.lotsStock) {
      if (lot.lotParentId !== null && !lotsParId.has(lot.lotParentId)) {
        parentsACharger.add(lot.lotParentId);
      }
    }
    let gardeFou = 0;
    while (parentsACharger.size > 0 && gardeFou < 100) {
      gardeFou += 1;
      const parents = await this.prisma.lotStock.findMany({
        where: { id: { in: Array.from(parentsACharger) } },
        include: {
          exercice: { select: { soaId: true } },
        },
      });
      parentsACharger.clear();
      for (const parent of parents) {
        if (parent.exercice.soaId !== exercice.soaId) continue;
        if (!lotsParId.has(parent.id)) {
          lotsParId.set(parent.id, parent);
          if (parent.lotParentId !== null && !lotsParId.has(parent.lotParentId)) {
            parentsACharger.add(parent.lotParentId);
          }
        }
      }
    }

    const date = dateDemandee ??
      (exercice.inventaire
        ? dayString(exercice.inventaire.dateInventaire)
        : dayString(exercice.dateFin));
    const { date: dateInventaire, cutoff } = parseInventoryDate(date);
    if (
      dateInventaire < new Date(Date.UTC(exercice.annee, 0, 1)) ||
      dateInventaire > new Date(Date.UTC(exercice.annee, 11, 31))
    ) {
      throw new BadRequestException(
        'La date d’inventaire doit appartenir à l’exercice sélectionné',
      );
    }

    const articles = new Map<number, ArticleStock>();
    const lignes = new Map<
      string,
      {
        article: ArticleStock;
        price: Prisma.Decimal;
        detail: DetailStock | null;
        lots: typeof exercice.lotsStock;
        mouvements: typeof exercice.mouvements;
        saved: SavedInventoryLine | null;
        warnings: Set<string>;
      }
    >();
    const getLine = (article: ArticleStock, price: Prisma.Decimal) => {
      const key = stockKey(article.id, price);
      articles.set(article.id, article);
      let line = lignes.get(key);
      if (!line) {
        line = {
          article,
          price: new Prisma.Decimal(price),
          detail: null,
          lots: [],
          mouvements: [],
          saved: null,
          warnings: new Set<string>(),
        };
        lignes.set(key, line);
      }
      return line;
    };

    for (const detail of exercice.compteMatiere?.details ?? []) {
      const line = getLine(detail.article, new Prisma.Decimal(detail.prixUnitaire));
      line.detail = detail;
    }
    for (const lot of exercice.lotsStock) {
      getLine(lot.article, new Prisma.Decimal(lot.prixUnitaire)).lots.push(lot);
    }
    for (const mouvement of exercice.mouvements) {
      getLine(mouvement.article, new Prisma.Decimal(mouvement.prixUnitaire))
        .mouvements.push(mouvement);
    }
    const savedInventoryMatchesDate =
      !!exercice.inventaire &&
      dayString(exercice.inventaire.dateInventaire) === date;
    for (const saved of savedInventoryMatchesDate
      ? exercice.inventaire?.lignes ?? []
      : []) {
      const article = articles.get(saved.articleId) ?? (await this.prisma.article.findUnique({
        where: { id: saved.articleId },
        include: { nomenclature: { select: { code: true, libelle: true } } },
      }));
      if (article) {
        getLine(article as ArticleStock, new Prisma.Decimal(saved.prixUnitaire)).saved = saved;
      }
    }

    const isEndOfExercise = date === dayString(exercice.dateFin);
    const warnings: string[] = [];
    const result = Array.from(lignes.entries()).map(([key, line]) => {
      const zero = () => new Prisma.Decimal(0);
      const detailOpening = line.detail
        ? new Prisma.Decimal(line.detail.existantDebut)
        : null;

      const initialLots = line.lots.filter(
        (lot) =>
          lot.typeOrigine === 'STOCK_INITIAL' &&
          lot.dateOrigine <= cutoff,
      );
      const hasChildReport = initialLots.some((lot) => lot.lotParentId !== null);
      const canonicalInitialLots = initialLots.filter((lot) => {
        const duplicatedLinkedRoot =
          hasChildReport &&
          lot.lotParentId === null &&
          lot.detailCompteMatiereId !== null;
        if (
          hasChildReport &&
          lot.lotParentId === null &&
          lot.detailCompteMatiereId === null
        ) {
          line.warnings.add(
            `Lot initial racine ${lot.id} sans détail coexiste avec un lot reporté (${key}).`,
          );
        }
        return !duplicatedLinkedRoot;
      });
      const lotsOpening = canonicalInitialLots.reduce(
        (total, lot) => total.plus(lot.quantiteInitiale),
        zero(),
      );
      const opening = detailOpening ?? lotsOpening;
      if (detailOpening && initialLots.length > 0 && !detailOpening.equals(lotsOpening)) {
        line.warnings.add(
          `Stock initial du détail (${detailOpening.toString()}) différent des lots (${lotsOpening.toString()}).`,
        );
      }
      if (opening.greaterThan(0) && canonicalInitialLots.length === 0) {
        line.warnings.add('Stock initial comptable sans lot STOCK_INITIAL matérialisé.');
      }

      const movementsAtDate = line.mouvements.filter(
        (mouvement) => mouvement.date <= cutoff,
      );
      const movementEntries = movementsAtDate
        .filter((mouvement) => mouvement.type === 'ENTREE')
        .reduce((sum, mouvement) => sum.plus(mouvement.quantite), zero());
      const movementExits = movementsAtDate
        .filter((mouvement) => mouvement.type === 'SORTIE')
        .reduce((sum, mouvement) => sum.plus(mouvement.quantite), zero());
      const detailEntries = new Prisma.Decimal(line.detail?.entrees ?? 0);
      const detailExits = new Prisma.Decimal(line.detail?.sorties ?? 0);
      const hasEntries = movementsAtDate.some((mouvement) => mouvement.type === 'ENTREE');
      const hasExits = movementsAtDate.some((mouvement) => mouvement.type === 'SORTIE');
      const entries = hasEntries ? movementEntries : isEndOfExercise ? detailEntries : zero();
      const exits = hasExits ? movementExits : isEndOfExercise ? detailExits : zero();
      if (!isEndOfExercise && ((!hasEntries && !detailEntries.isZero()) || (!hasExits && !detailExits.isZero()))) {
        line.warnings.add(
          'Les détails comptables agrègent les mouvements sans date; impossible de les ventiler à cette date précise.',
        );
      }
      if (hasEntries && !detailEntries.equals(movementEntries)) {
        line.warnings.add(
          `Entrées du détail (${detailEntries.toString()}) différentes des mouvements (${movementEntries.toString()}).`,
        );
      }
      if (hasExits && !detailExits.equals(movementExits)) {
        line.warnings.add(
          `Sorties du détail (${detailExits.toString()}) différentes des mouvements (${movementExits.toString()}).`,
        );
      }

      const lotsAtDate = line.lots.filter((lot) => lot.dateOrigine <= cutoff);
      const lotsAtDateWithChildren = new Set(
        lotsAtDate
          .filter((lot) => lot.typeOrigine === 'STOCK_INITIAL' && lot.lotParentId !== null)
          .map((lot) => `${lot.articleId}:${new Prisma.Decimal(lot.prixUnitaire).toFixed(2)}`),
      );
      const canonicalLotsAtDate = lotsAtDate.filter(
        (lot) =>
          !(
            lot.typeOrigine === 'STOCK_INITIAL' &&
            lot.lotParentId === null &&
            lot.detailCompteMatiereId !== null &&
            lotsAtDateWithChildren.has(
              `${lot.articleId}:${new Prisma.Decimal(lot.prixUnitaire).toFixed(2)}`,
            )
          ),
      );
      const entriesInLots = lotsAtDate
        .filter((lot) => lot.typeOrigine === 'ENTREE')
        .reduce((sum, lot) => sum.plus(lot.quantiteInitiale), zero());
      if (hasEntries && !entriesInLots.equals(movementEntries)) {
        line.warnings.add(
          `Entrées des lots (${entriesInLots.toString()}) différentes des mouvements (${movementEntries.toString()}).`,
        );
      }
      const totalFromLots = canonicalLotsAtDate.reduce(
        (sum, lot) => sum.plus(lot.quantiteInitiale),
        zero(),
      );

      let allocatedExits = zero();
      for (const mouvement of movementsAtDate.filter((item) => item.type === 'SORTIE')) {
        const assigned = mouvement.affectationsSortie.reduce(
          (sum, allocation) => sum.plus(allocation.quantite),
          zero(),
        );
        if (!assigned.equals(mouvement.quantite)) {
          line.warnings.add(
            `Sortie ${mouvement.id} affectée à hauteur de ${assigned.toString()} sur ${mouvement.quantite.toString()}.`,
          );
        }
        for (const allocation of mouvement.affectationsSortie) {
          const lot = allocation.lotStock;
          if (
            lot.exerciceId !== exercice.id ||
            lot.articleId !== line.article.id ||
            !new Prisma.Decimal(lot.prixUnitaire).equals(line.price) ||
            lot.dateOrigine > mouvement.date
          ) {
            line.warnings.add(
              `Affectation de la sortie ${mouvement.id} vers un lot incompatible (${lot.id}).`,
            );
          }
          allocatedExits = allocatedExits.plus(allocation.quantite);
        }
      }
      const lotsAtDateBalance = totalFromLots.minus(allocatedExits);
      // Observations des lots d'origine présents à cette date : chaque lot
      // remonte sa propre chaîne jusqu'à la racine (jamais d'emprunt à un
      // lot intermédiaire modifié), sans fusion ni doublon.
      const observationsLots: string[] = [];
      for (const lot of canonicalLotsAtDate) {
        const texte = observationOrigineChaine(lotsParId, lot.id);
        if (texte && !observationsLots.includes(texte)) observationsLots.push(texte);
      }
      // Observations = pièces justificatives des mouvements de l'exercice courant
      // (mouvements.observation), filtrés par la même date de référence que les
      // colonnes Entrées/Sorties, dédupliqués, sans emprunt aux autres exercices.
      const observationsMouvements: string[] = [];
      for (const mouvement of movementsAtDate) {
        const texte = normaliserTexteObservation(mouvement.observation);
        if (texte && !observationsMouvements.includes(texte)) observationsMouvements.push(texte);
      }
      const theoretical = opening.plus(entries).minus(exits);
      if (!theoretical.equals(lotsAtDateBalance)) {
        line.warnings.add(
          `Reste théorique (${theoretical.toString()}) différent du solde reconstitué des lots (${lotsAtDateBalance.toString()}).`,
        );
      }
      if (theoretical.lessThan(0) || lotsAtDateBalance.lessThan(0)) {
        line.warnings.add('Stock négatif détecté.');
      }

      if (isEndOfExercise) {
        const persistedLots = line.lots.filter((lot) => {
          const hasLinkedChild = line.lots.some(
            (child) =>
              child.typeOrigine === 'STOCK_INITIAL' &&
              child.lotParentId !== null &&
              child.articleId === lot.articleId &&
              new Prisma.Decimal(child.prixUnitaire).equals(lot.prixUnitaire),
          );
          return !(
            hasLinkedChild &&
            lot.typeOrigine === 'STOCK_INITIAL' &&
            lot.lotParentId === null &&
            lot.detailCompteMatiereId !== null
          );
        }).reduce(
          (sum, lot) => sum.plus(lot.quantiteRestante),
          zero(),
        );
        if (!persistedLots.equals(lotsAtDateBalance)) {
          line.warnings.add(
            `Quantités restantes enregistrées (${persistedLots.toString()}) différentes du solde reconstitué (${lotsAtDateBalance.toString()}).`,
          );
        }
      }

      warnings.push(...Array.from(line.warnings).map((warning) => `${line.article.designation} — ${line.price.toString()} Ar : ${warning}`));
      const saved = line.saved;
      const physical = saved ? new Prisma.Decimal(saved.quantitePhysique) : null;
      return {
        articleId: line.article.id,
        folioGrandLivre: line.detail?.folioGrandLivre ?? null,
        designation: line.article.designation,
        unite: line.article.unite,
        nomenclatureCode: line.article.nomenclature.code,
        nomenclature: line.article.nomenclature.libelle,
        prixUnitaire: line.price.toString(),
        existantDebut: opening.toString(),
        entrees: entries.toString(),
        sorties: exits.toString(),
        resteTheorique: theoretical.toString(),
        valeurTheorique: theoretical.mul(line.price).toString(),
        quantiteLots: lotsAtDateBalance.toString(),
        observationsLots,
        observationsMouvements,
        decomptePhysique: physical?.toString() ?? null,
        ecart: physical ? physical.minus(theoretical).toString() : null,
        observation: saved?.observation ?? null,
        observationDetail: line.detail?.observation ?? null,
        avertissements: Array.from(line.warnings),
      };
    });

    return {
      inventaireId: savedInventoryMatchesDate
        ? exercice.inventaire?.id ?? null
        : null,
      exercice: {
        id: exercice.id,
        annee: exercice.annee,
        dateDebut: exercice.dateDebut,
        dateFin: exercice.dateFin,
        statut: exercice.statut,
        soa: { id: exercice.soa.id, code: exercice.soa.code, libelle: exercice.soa.libelle },
      },
      dateInventaire: dayString(dateInventaire),
      dateInventaireEnregistre: exercice.inventaire
        ? dayString(exercice.inventaire.dateInventaire)
        : null,
      lieu: null,
      coherent: warnings.length === 0,
      avertissements: Array.from(new Set(warnings)),
      lignes: result.sort((a, b) =>
        a.nomenclatureCode.localeCompare(b.nomenclatureCode) ||
        a.designation.localeCompare(b.designation, 'fr') ||
        new Prisma.Decimal(a.prixUnitaire).comparedTo(b.prixUnitaire),
      ),
    };
  }

  async enregistrer(exerciceId: number, userId: number, dto: SaveInventaireDto) {
    await this.verifierAcces(exerciceId, userId, true);
    const { date, cutoff: _cutoff } = parseInventoryDate(dto.dateInventaire);
    const dateUtc = date;
    const seen = new Set<string>();

    for (const line of dto.lignes) {
      const price = new Prisma.Decimal(line.prixUnitaire);
      const quantity = new Prisma.Decimal(line.quantitePhysique);
      if (!price.isFinite() || price.lessThan(0) || !quantity.isFinite() || quantity.lessThan(0)) {
        throw new BadRequestException('Le prix et le décompte doivent être des nombres positifs ou nuls');
      }
      if (price.decimalPlaces() > 2 || quantity.decimalPlaces() > 2) {
        throw new BadRequestException('Le prix et les quantités sont limités à deux décimales');
      }
      const key = stockKey(line.articleId, price);
      if (seen.has(key)) throw new BadRequestException(`Ligne d’inventaire dupliquée : ${key}`);
      seen.add(key);
    }

    await this.prisma.$transaction(async (tx) => {
      const exercise = await tx.exercice.findUnique({
        where: { id: exerciceId },
        select: { id: true, annee: true },
      });
      if (!exercise) throw new NotFoundException('Exercice introuvable');
      const yearStart = new Date(Date.UTC(exercise.annee, 0, 1));
      const yearEnd = new Date(Date.UTC(exercise.annee, 11, 31));
      if (dateUtc < yearStart || dateUtc > yearEnd) {
        throw new BadRequestException('La date d’inventaire doit appartenir à l’exercice sélectionné');
      }

      const [details, lots, mouvements] = await Promise.all([
        tx.detailCompteMatiere.findMany({
          where: { compteMatiere: { exerciceId } },
          select: { articleId: true, prixUnitaire: true },
        }),
        tx.lotStock.findMany({ where: { exerciceId }, select: { articleId: true, prixUnitaire: true } }),
        tx.mouvement.findMany({ where: { exerciceId }, select: { articleId: true, prixUnitaire: true } }),
      ]);
      const existingInventory = await tx.inventaire.findUnique({
        where: { exerciceId },
        select: { dateInventaire: true },
      });
      if (
        existingInventory &&
        dayString(existingInventory.dateInventaire) !== dto.dateInventaire
      ) {
        throw new ConflictException(
          `Un inventaire est déjà enregistré au ${dayString(existingInventory.dateInventaire)} pour cet exercice.`,
        );
      }
      const allowedKeys = new Set([
        ...details.map((item) => stockKey(item.articleId, new Prisma.Decimal(item.prixUnitaire))),
        ...lots.map((item) => stockKey(item.articleId, new Prisma.Decimal(item.prixUnitaire))),
        ...mouvements.map((item) => stockKey(item.articleId, new Prisma.Decimal(item.prixUnitaire))),
      ]);
      for (const line of dto.lignes) {
        if (!allowedKeys.has(stockKey(line.articleId, new Prisma.Decimal(line.prixUnitaire)))) {
          throw new BadRequestException(`Article/prix absent de l’exercice ${exercise.annee}`);
        }
      }

      const inventory = await tx.inventaire.upsert({
        where: { exerciceId },
        create: { exerciceId, dateInventaire: dateUtc },
        update: { dateInventaire: dateUtc },
      });
      for (const line of dto.lignes) {
        const price = new Prisma.Decimal(line.prixUnitaire);
        const quantity = new Prisma.Decimal(line.quantitePhysique);
        const where = {
          inventaireId_articleId_prixUnitaire: {
            inventaireId: inventory.id,
            articleId: line.articleId,
            prixUnitaire: price,
          },
        };
        await tx.ligneInventaire.upsert({
          where,
          create: {
            inventaireId: inventory.id,
            articleId: line.articleId,
            prixUnitaire: price,
            quantitePhysique: quantity,
          },
          update: {
            quantitePhysique: quantity,
          },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return this.obtenir(exerciceId, userId, dto.dateInventaire);
  }
}
