import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { QueryJournalAuditDto } from './dto/query-journal-audit.dto.js';

export interface EntreeJournalAudit {
  action: string;
  entite?: string;
  entiteId?: number;
  auteurId?: number | null;
  details?: string;
  ip?: string;
}

@Injectable()
export class JournalAuditService {
  private readonly logger = new Logger(JournalAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre une action sensible.
   *
   * Ne lève jamais : une panne du journal ne doit pas faire échouer l'action
   * métier qui vient de réussir. Aucune donnée secrète (mot de passe, charge
   * utile complète) n'est transmise ici.
   */
  async enregistrer(entree: EntreeJournalAudit): Promise<void> {
    try {
      let auteurNom: string | null = null;
      if (entree.auteurId) {
        const auteur = await this.prisma.user.findUnique({
          where: { id: entree.auteurId },
          select: { nom: true, prenom: true, imatricule: true },
        });
        if (auteur) {
          auteurNom = `${auteur.prenom} ${auteur.nom} (${auteur.imatricule})`;
        }
      }

      await this.prisma.journalAudit.create({
        data: {
          action: entree.action,
          entite: entree.entite ?? null,
          entiteId: entree.entiteId ?? null,
          auteurId: entree.auteurId ?? null,
          auteurNom,
          details: entree.details ?? null,
          ip: entree.ip ?? null,
        },
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      this.logger.warn(
        `Échec de journalisation (${entree.action}) : ${message}`,
      );
    }
  }

  async lister(query: QueryJournalAuditDto) {
    const page = query.page ?? 1;
    const taille = query.taille ?? 20;

    const where: Prisma.JournalAuditWhereInput = {};
    if (query.auteurId !== undefined) {
      where.auteurId = query.auteurId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.dateDebut || query.dateFin) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.dateDebut) {
        createdAt.gte = debutDeJour(query.dateDebut);
      }
      if (query.dateFin) {
        createdAt.lte = finDeJour(query.dateFin);
      }
      where.createdAt = createdAt;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.journalAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * taille,
        take: taille,
      }),
      this.prisma.journalAudit.count({ where }),
    ]);

    return { items, total, page, taille };
  }
}

function debutDeJour(valeur: string): Date {
  const date = new Date(valeur);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function finDeJour(valeur: string): Date {
  const date = new Date(valeur);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}
