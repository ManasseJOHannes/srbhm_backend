import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Role } from '@prisma/client';

import { JwtStrategy, type JwtPayload } from './jwt.strategy.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

const LIGNE = {
  id: 7,
  imatricule: 'EMP-0007',
  email: 'rakoto@example.mg',
  // L'enum, pas la chaîne : `Role` est un enum, et 'ADMIN' s'inférerait
  // en `string`, ce que `validate()` refuse.
  role: Role.ADMIN,
  tokenVersion: 3,
};

const PAYLOAD: JwtPayload = {
  sub: 7,
  imatricule: 'EMP-0007',
  email: 'rakoto@example.mg',
  role: Role.ADMIN,
  tokenVersion: 3,
};

describe('JwtStrategy - révocation par tokenVersion', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    prisma = { user: { findUnique: vi.fn().mockResolvedValue(LIGNE) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('accepte un jeton dont la version correspond', async () => {
    const user = await strategy.validate(PAYLOAD);

    expect(user).toEqual({
      id: 7,
      imatricule: 'EMP-0007',
      email: 'rakoto@example.mg',
      role: Role.ADMIN,
    });
  });

  it('rejette un jeton antérieur à un changement de mot de passe', async () => {
    // Le mot de passe a changé : la base est à 4, le jeton porte encore 3.
    prisma.user.findUnique.mockResolvedValue({ ...LIGNE, tokenVersion: 4 });

    await expect(strategy.validate(PAYLOAD)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejette un jeton si le compte a été supprimé', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(PAYLOAD)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('relit le rôle en base : un rétrogradage est immédiat', async () => {
    // Le jeton dit encore ADMIN, la base dit COMPTABLE.
    prisma.user.findUnique.mockResolvedValue({ ...LIGNE, role: Role.COMPTABLE });

    const user = await strategy.validate(PAYLOAD);

    expect(user.role).toBe(Role.COMPTABLE);
  });

  it('interroge la base à chaque requête (condition de la révocation)', async () => {
    await strategy.validate(PAYLOAD);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: expect.objectContaining({ tokenVersion: true }),
    });
  });
});