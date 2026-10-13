import { ConflictException, NotFoundException } from '@nestjs/common';
import { NomenclaturesService } from './nomenclatures.service.js';

function makeService() {
  const prisma = {
    nomenclature: {
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 2, ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { service: new NomenclaturesService(prisma as never), prisma };
}

describe('NomenclaturesService règles de gestion', () => {
  it('refuse un code déjà utilisé', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.nomenclature.findUnique).mockResolvedValue({ id: 2 } as never);
    await expect(
      service.create({ code: 'NOM-01', libelle: 'Mobilier' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuse la suppression d'une nomenclature utilisée", async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.nomenclature.findUnique).mockResolvedValue({
      id: 2,
      _count: { articles: 2 },
    } as never);
    await expect(service.remove(2)).rejects.toBeInstanceOf(ConflictException);
  });

  it('retourne 404 sur nomenclature inconnue', async () => {
    const { service } = makeService();
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
