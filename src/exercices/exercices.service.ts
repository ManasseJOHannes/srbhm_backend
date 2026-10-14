import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateExerciceDto } from './dto/update-exercice.dto.js';
import { CreateExerciceDto} from './dto/create-exercice.dto.js';
import { CompteMatieresService } from '../compte-matieres/compte-matieres.service.js';

@Injectable()
export class ExercicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly compteMatieresService: CompteMatieresService,
  ) {}

async create(
  createExerciceDto: CreateExerciceDto,
  userId: number,
) {
  const { annee } = createExerciceDto;

  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select:{
      id: true,
      soaId: true,
      role: true,
    }
  });
  if (!user) {
    throw new NotFoundException('Utilisateur introuvable');
  }

  const soaId = user.soaId;

  if (!soaId) {
    throw new NotFoundException(
      'Aucun SOA associé à cet utilisateur',
    );
  }

  // Vérifier que le SOA existe
  const soa = await this.prisma.sOA.findUnique({
    where: { id: soaId },
  });

  if (!soa) {
    throw new NotFoundException('SOA introuvable');
  }

  // Vérifier si l'exercice existe déjà pour ce SOA
  const exerciceExiste = await this.prisma.exercice.findUnique({
    where: {
      soaId_annee: {
        soaId,
        annee,
      },
    },
  });

  if (exerciceExiste) {
    throw new ConflictException(
      `L'exercice ${annee} existe déjà pour ce SOA`,
    );
  }

  const dateDebut = new Date(Date.UTC(annee, 0, 1));
  const dateFin = new Date(Date.UTC(annee, 11, 31));

  const created = await this.prisma.$transaction(async (tx) => {
    const exercice = await tx.exercice.create({
      data: {
        annee,
        dateDebut,
        dateFin,
        soaId,
        statut: 'EN_COURS',
      },
    });

    return tx.exercice.findUnique({
      where: { id: exercice.id },
      include: {
        soa: true,
      },
    });
  });

  // Les restes de N-1 deviennent l'existant de N : report définitif
  // depuis le dernier exercice clôturé antérieur, s'il existe.
  const precedent = await this.prisma.exercice.findUnique({
    where: { soaId_annee: { soaId, annee: annee - 1 } },
  });
  if (precedent && precedent.statut === 'CLOTURE') {
    await this.compteMatieresService.reporterDepuisDernierCloture(
      soaId,
      annee,
    );
  }

  return created;
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
    const where=
      user.role === 'DEPOSITEUR_COMPTABLE'
        ? { soaId: user.soaId }
        : {};

    return this.prisma.exercice.findMany({
      where,
      include: {
        soa: true,
      },
      orderBy: {
        annee: 'desc',
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
    if(!user){
      throw new NotFoundException('Utilisateur introuvable');
    }
    const exercice = await this.prisma.exercice.findUnique({
      where: { id },
      include: {
        soa: true,
      },
    });

    if (!exercice) {
      throw new NotFoundException('Exercice introuvable');
    }
    if (user.role === 'DEPOSITEUR_COMPTABLE' && exercice.soaId !== user.soaId) {
      throw new NotFoundException('Exercice introuvable pour cet utilisateur');
    }

    return exercice;
  }

  async update(id: number, updateExerciceDto: UpdateExerciceDto, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        soaId: true,
      },
    });
    if(!user){
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (user.role !== 'DEPOSITEUR_COMPTABLE') {
      throw new ForbiddenException('Seul le dépositaire-comptable peut modifier un exercice');
    }
    const exercice = await this.prisma.exercice.findUnique({
      where: { id },
    });

    if (!exercice) {
      throw new NotFoundException('Exercice introuvable');
    }
    if(exercice.soaId !== user.soaId){
      throw new NotFoundException('Exercice introuvable pour cet utilisateur');
    }
    if (exercice.statut === 'CLOTURE') {
      throw new ForbiddenException('Un exercice clôturé ne peut pas être rouvert');
    }

    const updated = await this.prisma.exercice.update({
      where: { id },
      data: updateExerciceDto,
      include: {
        soa: true,
      },
    });

    // Clôture : les restes au 31 décembre deviennent l'existant de N+1.
    if (updateExerciceDto.statut === 'CLOTURE') {
      await this.compteMatieresService.reporterSoldes(id);
    }

    return updated;
  }

  async remove(id: number, userId: number) {
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
    if (user.role !== 'DEPOSITEUR_COMPTABLE') {
      throw new ForbiddenException('Seul le dépositaire-comptable peut supprimer un exercice');
    }
    const exercice = await this.prisma.exercice.findUnique({
      where: { id },
    });

    if (!exercice) {
      throw new NotFoundException('Exercice introuvable');
    }
    if (exercice.soaId !== user.soaId) {
      throw new NotFoundException('Exercice introuvable pour cet utilisateur');
    }
    if (exercice.statut === 'CLOTURE') {
      throw new ForbiddenException('Un exercice clôturé ne peut pas être supprimé');
    }

    return this.prisma.exercice.delete({
      where: { id },
    });
  }
}
