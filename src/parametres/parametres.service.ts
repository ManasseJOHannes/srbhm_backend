import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdatePrixMinimalDto } from './dto/update-prix-minimal.dto.js';

export const CLE_PRIX_MINIMAL = 'prix_minimal_compte_matiere';
export const PRIX_MINIMAL_DEFAUT = 50_000;

@Injectable()
export class ParametresService {
  constructor(private readonly prisma: PrismaService) {}

  async getPrixMinimal(): Promise<number> {
    const parametre = await this.prisma.parametre.findUnique({
      where: { cle: CLE_PRIX_MINIMAL },
    });
    const valeur = Number(parametre?.valeur);
    return Number.isFinite(valeur) && valeur > 0
      ? valeur
      : PRIX_MINIMAL_DEFAUT;
  }

  async updatePrixMinimal(dto: UpdatePrixMinimalDto) {
    const parametre = await this.prisma.parametre.upsert({
      where: { cle: CLE_PRIX_MINIMAL },
      update: { valeur: String(dto.prixMinimal) },
      create: {
        cle: CLE_PRIX_MINIMAL,
        valeur: String(dto.prixMinimal),
      },
    });
    return { prixMinimal: Number(parametre.valeur) };
  }
}
