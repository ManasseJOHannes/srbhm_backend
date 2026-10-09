import { Injectable } from '@nestjs/common';
import { CreateCompteMatiereDto } from './dto/create-compte-matiere.dto.js';
import { UpdateCompteMatiereDto } from './dto/update-compte-matiere.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { MouvementService } from '../mouvement/mouvement.service.js';
@Injectable()
export class CompteMatieresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mouvementService: MouvementService,
  ) {}

  async create(
    createCompteMatiereDto: CreateCompteMatiereDto,
    userId: number,
  ) {
    const { annee } = createCompteMatiereDto;
    const currentYear = new Date().getFullYear();

    if (annee >= currentYear) {
      throw new BadRequestException(
        `Le Compte Matière doit être créé pour une année antérieure à ${currentYear}`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        soaId: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new BadRequestException(
        'Seul un dépositaire-comptable peut créer un Compte Matière',
      );
    }

    const soa = await this.prisma.sOA.findUnique({
      where: { id: user.soaId },
    });

    if (!soa) {
      throw new NotFoundException('SOA introuvable');
    }

    return this.prisma.$transaction(async (tx) => {
      let exercice = await tx.exercice.findUnique({
        where: {
          soaId_annee: {
            soaId: user.soaId,
            annee,
          },
        },
      });

      if (!exercice) {
        exercice = await tx.exercice.create({
          data: {
            annee,
            dateDebut: new Date(Date.UTC(annee, 0, 1)),
            dateFin: new Date(Date.UTC(annee, 11, 31)),
            soaId: user.soaId,
            statut: 'EN_COURS',
          },
        });
      }

      const compteMatiereExiste =
        await tx.compteMatiere.findUnique({
          where: {
            exerciceId: exercice.id,
          },
        });

      if (compteMatiereExiste) {
        throw new ConflictException(
          `Le Compte Matière ${annee} existe déjà pour ce SOA`,
        );
      }

      const compteMatiere = await tx.compteMatiere.create({
        data: {
          exerciceId: exercice.id,
        },
        include: {
          exercice: {
            include: {
              soa: true,
            },
          },
        },
      });

      await this.mouvementService.reporterStockDepuisExercicePrecedent(
        exercice.id,
        userId,
        tx,
      );

      // Le report peut créer les détails d'ouverture et recalculer les
      // montants du compte. Retourner la version relue dans la transaction
      // évite au frontend de recevoir l'objet antérieur au report.
      return tx.compteMatiere.findUnique({
        where: { id: compteMatiere.id },
        include: {
          exercice: { include: { soa: true } },
          details: {
            include: {
              article: { include: { nomenclature: true } },
            },
          },
        },
      });
    });
  }

  async findAll(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        soaId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const where =
      user.role === Role.DEPOSITEUR_COMPTABLE
        ? { exercice: { soaId: user.soaId } }
        : {};

    return this.prisma.compteMatiere.findMany({
      where,
      include: {
        exercice: {
          include: {
            soa: true,
          },
        },
        details: {
          include: {
            article: {
              include: {
                nomenclature: true,
              },
            },
          },
        },
      },
      orderBy: {
        exercice: {
          annee: 'desc',
        },
      },
    });
  }

  async findOne(id: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        soaId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const compteMatiere = await this.prisma.compteMatiere.findUnique({
      where: {
        id,
      },
      include: {
        exercice: {
          include: {
            soa: true,
          },
        },
        details: {
          include: {
            article: {
              include: {
                nomenclature: true,
              },
            },
          },
        },
      },
    });

    if (!compteMatiere) {
      throw new NotFoundException('Compte Matière introuvable');
    }

    if (
      user.role === Role.DEPOSITEUR_COMPTABLE &&
      compteMatiere.exercice.soaId !== user.soaId
    ) {
      throw new NotFoundException('Compte Matière introuvable');
    }

    return compteMatiere;
  }

  async update(
    id: number,
    updateCompteMatiereDto: UpdateCompteMatiereDto,
    userId: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new ForbiddenException('Seul un dépositaire-comptable peut modifier un Compte Matière');
    }

    const annee = updateCompteMatiereDto.annee;
    if (!Number.isInteger(annee) || annee! < 2000) {
      throw new BadRequestException('Une année valide est requise pour modifier le Compte Matière');
    }
    if (annee! >= new Date().getFullYear()) {
      throw new BadRequestException('Un Compte Matière ne peut concerner qu’un exercice antérieur à l’année courante');
    }

    return this.prisma.$transaction(async (tx) => {
      const compte = await tx.compteMatiere.findUnique({
        where: { id },
        include: {
          details: true,
          exercice: {
            include: { _count: { select: { mouvements: true, lotsStock: true } } },
          },
        },
      });
      if (!compte || compte.exercice.soaId !== user.soaId) {
        throw new NotFoundException('Compte Matière introuvable');
      }

      if (compte.exercice.annee === annee) {
        return tx.compteMatiere.findUnique({
          where: { id },
          include: { exercice: { include: { soa: true } }, details: true },
        });
      }

      if (
        compte.details.length > 0 ||
        compte.exercice._count.mouvements > 0 ||
        compte.exercice._count.lotsStock > 0
      ) {
        throw new BadRequestException(
          'L’année ne peut être corrigée après l’ajout de détails, de mouvements ou de lots de stock.',
        );
      }

      const exerciceExiste = await tx.exercice.findUnique({
        where: { soaId_annee: { soaId: compte.exercice.soaId, annee: annee! } },
      });
      if (exerciceExiste && exerciceExiste.id !== compte.exerciceId) {
        throw new ConflictException(`L’exercice ${annee} existe déjà pour ce SOA`);
      }

      await tx.exercice.update({
        where: { id: compte.exerciceId },
        data: {
          annee: annee!,
          dateDebut: new Date(Date.UTC(annee!, 0, 1)),
          dateFin: new Date(Date.UTC(annee!, 11, 31)),
        },
      });

      return tx.compteMatiere.findUnique({
        where: { id },
        include: {
          exercice: { include: { soa: true } },
          details: { include: { article: { include: { nomenclature: true } } } },
        },
      });
    });
  }

  async remove(id: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, soaId: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== Role.DEPOSITEUR_COMPTABLE) {
      throw new ForbiddenException('Seul un dépositaire-comptable peut supprimer un Compte Matière');
    }

    return this.prisma.$transaction(async (tx) => {
      const compte = await tx.compteMatiere.findUnique({
        where: { id },
        include: {
          details: true,
          exercice: {
            include: { _count: { select: { mouvements: true, lotsStock: true } } },
          },
        },
      });
      if (!compte || compte.exercice.soaId !== user.soaId) {
        throw new NotFoundException('Compte Matière introuvable');
      }

      const valeursNonNulles = [
        compte.valeurExistanteDebut,
        compte.valeurEntrees,
        compte.valeurSorties,
        compte.valeurRestante,
      ].some((valeur) => !new Prisma.Decimal(valeur).isZero());

      if (
        compte.details.length > 0 ||
        compte.exercice._count.mouvements > 0 ||
        compte.exercice._count.lotsStock > 0 ||
        valeursNonNulles
      ) {
        throw new BadRequestException(
          'Suppression refusée : ce Compte Matière possède des détails, mouvements, lots de stock ou des valeurs enregistrées.',
        );
      }

      return tx.compteMatiere.delete({ where: { id } });
    });
  }
}
