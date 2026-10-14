import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CreateCompteMatiereDto } from './dto/create-compte-matiere.dto.js';
import { CreateDetailDto } from './dto/create-detail.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ROLES_LECTURE: readonly Role[] = [
  Role.ADMIN,
  Role.COMPTABLE,
  Role.DEPOSITEUR_COMPTABLE,
];

function assertLecture(user: { role: Role }) {
  if (!ROLES_LECTURE.includes(user.role)) {
    throw new ForbiddenException('Accès à la comptabilité refusé');
  }
}

async function chargerExercicePourEcriture(
  prisma: PrismaService,
  exerciceId: number,
  userId: number,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, soaId: true },
  });
  if (!user) throw new NotFoundException('Utilisateur introuvable');
  if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
    throw new ForbiddenException('Seul le dépositaire-comptable peut écrire');
  }
  const exercice = await prisma.exercice.findUnique({
    where: { id: exerciceId },
  });
  if (!exercice || exercice.soaId !== user.soaId) {
    throw new NotFoundException('Exercice introuvable pour cet utilisateur');
  }
  if (exercice.statut === 'CLOTURE') {
    throw new ForbiddenException('Cet exercice est clôturé');
  }
  return exercice;
}

export async function recalculerValeursCompte(  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  compteMatiereId: number,
) {
  const details = await tx.detailCompteMatiere.findMany({
    where: { compteMatiereId },
  });
  let debut = 0;
  let entrees = 0;
  let sorties = 0;
  for (const detail of details) {
    const prix = Number(detail.prixUnitaire);
    debut += Number(detail.existantDebut) * prix;
    entrees += Number(detail.entrees) * prix;
    sorties += Number(detail.sorties) * prix;
  }
  return tx.compteMatiere.update({
    where: { id: compteMatiereId },
    data: {
      valeurExistanteDebut: debut,
      valeurEntrees: entrees,
      valeurSorties: sorties,
      valeurRestante: debut + entrees - sorties,
    },
  });
}

@Injectable()
export class CompteMatieresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateCompteMatiereDto, userId: number) {
    const exercice = await chargerExercicePourEcriture(
      this.prisma,
      createDto.exerciceId,
      userId,
    );
    const existing = await this.prisma.compteMatiere.findUnique({
      where: { exerciceId: exercice.id },
    });
    if (existing) {
      throw new ConflictException(
        `Le compte matière de l'exercice ${exercice.annee} existe déjà`,
      );
    }
    return this.prisma.compteMatiere.create({
      data: { exerciceId: exercice.id },
      include: { exercice: { include: { soa: true } } },
    });
  }

  async findAll(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    assertLecture(user);
    return this.prisma.compteMatiere.findMany({
      where:
        user.role === Role.DEPOSITEUR_COMPTABLE
          ? { exercice: { soaId: user.soaId } }
          : undefined,
      include: {
        exercice: { include: { soa: true } },
        _count: { select: { details: true } },
      },
      orderBy: { exercice: { annee: 'desc' } },
    });
  }

  async findOne(id: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    assertLecture(user);
    const compte = await this.prisma.compteMatiere.findUnique({
      where: { id },
      include: {
        exercice: { include: { soa: true } },
        details: {
          include: { article: { include: { nomenclature: true } } },
          orderBy: [{ article: { designation: 'asc' } }, { prixUnitaire: 'asc' }],
        },
      },
    });
    if (
      !compte ||
      (user.role === Role.DEPOSITEUR_COMPTABLE &&
        compte.exercice.soaId !== user.soaId)
    ) {
      throw new NotFoundException('Compte matière introuvable');
    }
    return compte;
  }

  async remove(id: number, userId: number) {
    const compte = await this.findOne(id, userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new ForbiddenException('Seul le dépositaire-comptable peut supprimer');
    }
    if (compte.exercice.statut === 'CLOTURE') {
      throw new ForbiddenException('Cet exercice est clôturé');
    }
    const mouvements = await this.prisma.mouvement.count({
      where: { exerciceId: compte.exerciceId },
    });
    const valeursNonNulles =
      !compte.valeurExistanteDebut.equals(0) ||
      !compte.valeurEntrees.equals(0) ||
      !compte.valeurSorties.equals(0);
    if (compte.details.length > 0 || mouvements > 0 || valeursNonNulles) {
      throw new BadRequestException(
        'Suppression refusée : le compte contient des détails, mouvements ou valeurs',
      );
    }
    return this.prisma.compteMatiere.delete({ where: { id } });
  }

  async addDetail(compteId: number, dto: CreateDetailDto, userId: number) {
    const compte = await this.findOne(compteId, userId);
    await chargerExercicePourEcriture(this.prisma, compte.exerciceId, userId);
    const article = await this.prisma.article.findUnique({
      where: { id: dto.articleId },
    });
    if (!article) {
      throw new NotFoundException('Article introuvable');
    }
    const existing = await this.prisma.detailCompteMatiere.findUnique({
      where: {
        compteMatiereId_articleId_prixUnitaire: {
          compteMatiereId: compte.id,
          articleId: dto.articleId,
          prixUnitaire: dto.prixUnitaire,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Un détail existe déjà pour cet article et ce prix',
      );
    }
    const detail = await this.prisma.detailCompteMatiere.create({
      data: {
        compteMatiereId: compte.id,
        articleId: dto.articleId,
        folioGrandLivre: dto.folioGrandLivre,
        prixUnitaire: dto.prixUnitaire,
        existantDebut: dto.existantDebut,
        observation: dto.observation,
      },
      include: { article: { include: { nomenclature: true } } },
    });
    await this.prisma.$transaction(async (tx) => {
      await recalculerValeursCompte(tx, compte.id);
    });
    return detail;
  }

  async getDetails(compteId: number, userId: number) {
    const compte = await this.findOne(compteId, userId);
    return compte.details;
  }

  /**
   * Report définitif : les restes au 31 décembre de l'exercice source
   * (clôturé) deviennent l'existant de début de l'exercice suivant
   * (même SOA), avec folio et observation recopiés. Idempotent : les
   * détails déjà présents ne sont jamais écrasés mais signalés en
   * conflits. On n'écrit jamais sur un exercice clôturé.
   */
  async reporterSoldes(exerciceId: number) {
    const source = await this.prisma.exercice.findUnique({
      where: { id: exerciceId },
      include: {
        compteMatiere: {
          include: { details: { include: { article: true } } },
        },
      },
    });
    if (!source) {
      throw new NotFoundException('Exercice source introuvable');
    }
    if (source.statut !== 'CLOTURE') {
      throw new BadRequestException(
        'Seul un exercice clôturé peut être reporté',
      );
    }
    const cible = await this.prisma.exercice.findUnique({
      where: {
        soaId_annee: { soaId: source.soaId, annee: source.annee + 1 },
      },
    });
    if (!cible) {
      return { reporte: false as const, raison: 'AUCUN_EXERCICE_SUIVANT' };
    }
    return this.reporterVers(source, cible);
  }

  /**
   * Report vers un exercice cible depuis le dernier exercice clôturé
   * antérieur (même SOA). Sert la création de N+k.
   */
  async reporterDepuisDernierCloture(soaId: number, anneeCible: number) {
    const cible = await this.prisma.exercice.findUnique({
      where: { soaId_annee: { soaId, annee: anneeCible } },
    });
    if (!cible) {
      return { reporte: false as const, raison: 'CIBLE_INTROUVABLE' };
    }
    const source = await this.prisma.exercice.findFirst({
      where: { soaId, annee: { lt: anneeCible }, statut: 'CLOTURE' },
      orderBy: { annee: 'desc' },
      include: {
        compteMatiere: { include: { details: { include: { article: true } } } },
      },
    });
    if (!source) {
      return { reporte: false as const, raison: 'AUCUN_CLOTURE_ANTERIEUR' };
    }
    return this.reporterVers(source, cible);
  }

  private async reporterVers(
    source: {
      id: number;
      annee: number;
      soaId: number;
      compteMatiere: {
        details: {
          articleId: number;
          prixUnitaire: unknown;
          folioGrandLivre: number | null;
          observation: string | null;
          existantDebut: unknown;
          entrees: unknown;
          sorties: unknown;
          article: { designation: string };
        }[];
      } | null;
    },
    cible: { id: number; annee: number; statut: string },
  ) {
    if (cible.statut === 'CLOTURE') {
      return { reporte: false as const, raison: 'EXERCICE_SUIVANT_CLOTURE' };
    }
    const soldes = (source.compteMatiere?.details ?? []).map((detail) => ({
      articleId: detail.articleId,
      designation: detail.article.designation,
      prixUnitaire: Number(detail.prixUnitaire),
      folioGrandLivre: detail.folioGrandLivre,
      observation: detail.observation?.trim() || null,
      quantite:
        Number(detail.existantDebut) +
        Number(detail.entrees) -
        Number(detail.sorties),
    }));

    return this.prisma.$transaction(async (tx) => {
      let compte = await tx.compteMatiere.findUnique({
        where: { exerciceId: cible.id },
      });
      if (!compte) {
        compte = await tx.compteMatiere.create({
          data: { exerciceId: cible.id },
        });
      }
      let reportes = 0;
      let ignores = 0;
      const conflits: {
        articleId: number;
        prixUnitaire: number;
        existantEnregistre: number;
        quantiteReportee: number;
      }[] = [];
      for (const solde of soldes) {
        if (solde.quantite <= 0) {
          ignores += 1;
          continue;
        }
        const existant = await tx.detailCompteMatiere.findUnique({
          where: {
            compteMatiereId_articleId_prixUnitaire: {
              compteMatiereId: compte.id,
              articleId: solde.articleId,
              prixUnitaire: solde.prixUnitaire,
            },
          },
        });
        if (existant) {
          ignores += 1;
          conflits.push({
            articleId: solde.articleId,
            prixUnitaire: solde.prixUnitaire,
            existantEnregistre: Number(existant.existantDebut),
            quantiteReportee: solde.quantite,
          });
          continue;
        }
        await tx.detailCompteMatiere.create({
          data: {
            compteMatiereId: compte.id,
            articleId: solde.articleId,
            prixUnitaire: solde.prixUnitaire,
            folioGrandLivre: solde.folioGrandLivre,
            existantDebut: solde.quantite,
            // R4 : l'observation par défaut inclut la désignation pour
            // rester unique par détail au sein du compte.
            observation:
              solde.observation ??
              `Stock reporté de l'exercice ${source.annee} — ${solde.designation}`,
          },
        });
        reportes += 1;
      }
      await recalculerValeursCompte(tx, compte.id);
      return {
        reporte: true as const,
        exerciceSource: source.annee,
        exerciceCible: cible.annee,
        reportes,
        ignores,
        conflits,
      };
    });
  }
}
