import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

import { AuthService, DUREE_JETON_RESET_MINUTES } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service.js';

const HASH_ACTUEL = bcrypt.hashSync('ancien123', 10);
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const PROFIL = {
  id: 7,
  imatricule: 'EMP-0007',
  nom: 'RAKOTO',
  prenom: 'Mamy',
  cin: '101051029954',
  telephone: '0340510299',
  adresse: 'Antsirabe',
  email: 'rakoto@example.mg',
  role: 'COMPTABLE',
  soa: { id: 1, code: 'SRB-HM', libelle: 'SRB Haute Matsiatra' },
  createdAt: new Date('2026-01-02T08:00:00Z'),
  updatedAt: new Date('2026-02-03T09:00:00Z'),
};

describe('AuthService - profil et auto-modification', () => {
  let service: AuthService;
  let prisma: any;

  // Titulaires des valeurs uniques, ajustables par chaque test.
  let emailOwner: { id: number } | null;
  let telephoneOwner: { id: number } | null;
  let passwordRow: { password: string } | null;
  let jetonRow: {
    id: number;
    userId: number;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  } | null;
  /** Résultat de `user.findFirst` (recherche par matricule OU email). */
  let matcheur: {
    id: number;
    email: string | null;
    nom: string;
    prenom: string;
    imatricule: string;
  } | null;
  let mailService: {
    sendPasswordResetNotification: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    emailOwner = null;
    telephoneOwner = null;
    passwordRow = null;
    jetonRow = null;
    matcheur = null;

    mailService = { sendPasswordResetNotification: vi.fn() };

    prisma = {
      user: {
        // On discrimine sur la forme de `where` / `select` comme le ferait
        // Prisma, plutôt que d'ordonner les appels.
        findUnique: vi.fn((args: Record<string, any>) => {
          const where = args?.where ?? {};
          const select = args?.select ?? {};

          if ('password' in select && Object.keys(select).length === 1) {
            return Promise.resolve(passwordRow);
          }
          if (where.id !== undefined) return Promise.resolve(PROFIL);
          if (where.email !== undefined) return Promise.resolve(emailOwner);
          if (where.telephone !== undefined) {
            return Promise.resolve(telephoneOwner);
          }
          return Promise.resolve(null);
        }),
        findFirst: vi.fn(() => Promise.resolve(matcheur)),
        update: vi.fn().mockResolvedValue(PROFIL),
      },
      passwordResetToken: {
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn(() => Promise.resolve(jetonRow)),
      },
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: vi.fn() } },
        {
          provide: MailService,
          useValue: mailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('me()', () => {
    it('renvoie le profil complet, sans le mot de passe', async () => {
      const profil = await service.me(7);

      expect(profil).toEqual(PROFIL);
      expect(profil).not.toHaveProperty('password');
    });

    it('lève 404 si l’utilisateur n’existe plus', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.me(7)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMe() — sécurité du whitelist', () => {
    it('ignore role, soaId, imatricule, cin, nom et prenom injectés', async () => {
      // Corps forgé : tentative de s'attribuer un rôle et un autre SOA.
      const dto = {
        adresse: 'Fianarantsoa',
        role: 'ADMIN',
        soaId: 999,
        imatricule: 'HACK-0001',
        cin: '000000000000',
        nom: 'PIRATE',
        prenom: 'PIRATE',
      } as never;

      await service.updateMe(7, dto);

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      const { data } = prisma.user.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };

      expect(data).toEqual({ adresse: 'Fianarantsoa' });
      expect(data).not.toHaveProperty('role');
      expect(data).not.toHaveProperty('soaId');
      expect(data).not.toHaveProperty('imatricule');
      expect(data).not.toHaveProperty('cin');
      expect(data).not.toHaveProperty('nom');
      expect(data).not.toHaveProperty('prenom');
    });

    it('n’écrit rien si aucun champ modifiable n’est fourni', async () => {
      await service.updateMe(7, {});

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuse un email déjà utilisé par un autre utilisateur', async () => {
      emailOwner = { id: 42 };

      await expect(
        service.updateMe(7, { email: 'prive@example.mg' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('accepte un email qui appartient déjà au même utilisateur', async () => {
      emailOwner = { id: 7 };

      await service.updateMe(7, { email: PROFIL.email });

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('refuse un téléphone déjà utilisé par un autre utilisateur', async () => {
      telephoneOwner = { id: 42 };

      await expect(
        service.updateMe(7, { telephone: '0340000000' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('renvoie le profil à jour après écriture', async () => {
      const resultat = await service.updateMe(7, {
        adresse: 'Fianarantsoa',
      });

      expect(resultat).toEqual(PROFIL);
    });
  });

  describe('changePassword()', () => {
    it('refuse un mot de passe actuel incorrect (401)', async () => {
      passwordRow = { password: HASH_ACTUEL };

      await expect(
        service.changePassword(7, {
          currentPassword: 'mauvais',
          newPassword: 'nouveau123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuse un nouveau mot de passe identique à l’ancien', async () => {
      passwordRow = { password: HASH_ACTUEL };

      await expect(
        service.changePassword(7, {
          currentPassword: 'ancien123',
          newPassword: 'ancien123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('stocke un hash bcrypt, jamais le mot de passe en clair', async () => {
      passwordRow = { password: HASH_ACTUEL };

      const resultat = await service.changePassword(7, {
        currentPassword: 'ancien123',
        newPassword: 'nouveau123',
      });

      expect(resultat.message).toContain('succès');
      expect(prisma.user.update).toHaveBeenCalledTimes(2); // mot de passe + révocation

      const { data } = prisma.user.update.mock.calls[0][0] as {
        data: { password: string };
      };

      expect(data.password).not.toBe('nouveau123');
      expect(await bcrypt.compare('nouveau123', data.password)).toBe(true);
    });

    it('révoque les sessions ouvertes (incrémente tokenVersion)', async () => {
      passwordRow = { password: HASH_ACTUEL };

      await service.changePassword(7, {
        currentPassword: 'ancien123',
        newPassword: 'nouveau123',
      });

      const incréments = prisma.user.update.mock.calls.filter(
        (c: any[]) => c[0].data?.tokenVersion !== undefined,
      );

      expect(incréments.length).toBe(1);
      expect(incréments[0][0].data.tokenVersion).toEqual({ increment: 1 });
    });
  });

  describe('demanderReinitialisation()', () => {
    const COMPTE = {
      id: 7,
      email: 'rakoto@example.mg',
      nom: 'RAKOTO',
      prenom: 'Mamy',
      imatricule: 'EMP-0007',
    };

    it('renvoie toujours le même message, compte inexistant compris', async () => {
      matcheur = null;

      const attendu = await service.demanderReinitialisation({
        identifier: 'INCONNU-0000',
      });
      const reel = await service.demanderReinitialisation({
        identifier: 'EMP-0007',
      });

      expect(attendu).toEqual(reel);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('stocke le SHA-256 du jeton, jamais le jeton en clair', async () => {
      matcheur = COMPTE;

      await service.demanderReinitialisation({ identifier: 'EMP-0007' });

      const { data } = prisma.passwordResetToken.create.mock.calls[0][0];

      expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);

      // Le jeton qui part par email est bien celui dont on a stocké le hash.
      const [{ token }] = mailService.sendPasswordResetNotification.mock.calls[0];
      expect(sha256(token)).toBe(data.tokenHash);
      expect(data.tokenHash).not.toBe(token);
    });

    it('purge les demandes précédentes (usage unique strict)', async () => {
      matcheur = COMPTE;

      await service.demanderReinitialisation({ identifier: 'EMP-0007' });

      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 7, usedAt: null },
      });
    });

    it('expire le jeton à la durée configurée', async () => {
      matcheur = COMPTE;

      await service.demanderReinitialisation({ identifier: 'EMP-0007' });

      const { data } = prisma.passwordResetToken.create.mock.calls[0][0];
      const minutes = (data.expiresAt.getTime() - Date.now()) / 60000;

      expect(minutes).toBeGreaterThan(DUREE_JETON_RESET_MINUTES - 1);
      expect(minutes).toBeLessThanOrEqual(DUREE_JETON_RESET_MINUTES);
    });

    it('n’envoie rien si le compte n’a pas d’email', async () => {
      matcheur = { ...COMPTE, email: null };

      const resultat = await service.demanderReinitialisation({
        identifier: 'EMP-0007',
      });

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(resultat.message).toContain('Si un compte correspond');
    });
  });

  describe('reinitialiserMotDePasse()', () => {
    const jeton = 'a'.repeat(64);

    function jetonValide() {
      jetonRow = {
        id: 1,
        userId: 7,
        tokenHash: sha256(jeton),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        usedAt: null,
      };
    }

    it('refuse un jeton inconnu', async () => {
      jetonRow = null;

      await expect(
        service.reinitialiserMotDePasse({ token: jeton, newPassword: 'nouveau123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un jeton expiré', async () => {
      jetonRow = {
        id: 1,
        userId: 7,
        tokenHash: sha256(jeton),
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      };

      await expect(
        service.reinitialiserMotDePasse({ token: jeton, newPassword: 'nouveau123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un jeton déjà utilisé', async () => {
      jetonRow = {
        id: 1,
        userId: 7,
        tokenHash: sha256(jeton),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        usedAt: new Date(),
      };

      await expect(
        service.reinitialiserMotDePasse({ token: jeton, newPassword: 'nouveau123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('change le mot de passe, marque le jeton utilisé et révoque les sessions', async () => {
      jetonValide();

      await service.reinitialiserMotDePasse({
        token: jeton,
        newPassword: 'nouveau123',
      });

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(await bcrypt.compare('nouveau123', data.password)).toBe(true);
      expect(data.tokenVersion).toEqual({ increment: 1 });

      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { usedAt: expect.any(Date) },
        }),
      );
    });

    it('écrit le mot de passe en clair ? — non, jamais', async () => {
      jetonValide();

      await service.reinitialiserMotDePasse({
        token: jeton,
        newPassword: 'nouveau123',
      });

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data.password).not.toBe('nouveau123');
    });
  });
});