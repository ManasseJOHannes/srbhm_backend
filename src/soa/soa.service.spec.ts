import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SoaService } from './soa.service.js';

describe('SoaService access control', () => {
  const makeService = (role: Role, soaId: number | null) => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ role, soaId }) },
      sOA: {
        findMany: vi.fn().mockResolvedValue([{ id: soaId, code: 'A', actif: true }]),
        findUnique: vi.fn().mockResolvedValue({ id: soaId, code: 'A' }),
      },
    };
    return { service: new SoaService(prisma as never), prisma };
  };

  it('limits a depositor list to their own SOA', async () => {
    const { service, prisma } = makeService(Role.DEPOSITEUR_COMPTABLE, 12);

    await service.findAll(4);

    expect(prisma.sOA.findMany).toHaveBeenCalledWith({
      where: { id: 12 },
      orderBy: { code: 'asc' },
    });
  });

  it('hides another SOA from a depositor', async () => {
    const { service, prisma } = makeService(Role.DEPOSITEUR_COMPTABLE, 12);

    await expect(service.findOne(13, 4)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.sOA.findUnique).not.toHaveBeenCalled();
  });

  it('allows a comptable to list all SOAs', async () => {
    const { service, prisma } = makeService(Role.COMPTABLE, null);

    await service.findAll(4);

    expect(prisma.sOA.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { code: 'asc' },
    });
  });

  it('keeps an unauthenticated registration list limited to active SOA fields', async () => {
    const { service, prisma } = makeService(Role.ADMIN, null);

    await service.findActive();

    expect(prisma.sOA.findMany).toHaveBeenCalledWith({
      where: { actif: true },
      select: { id: true, code: true, libelle: true, actif: true },
      orderBy: { code: 'asc' },
    });
  });

  it('refuses other roles', async () => {
    const { service } = makeService(Role.USER, null);

    await expect(service.findAll(4)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
