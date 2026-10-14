import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArticlesService } from './articles.service.js';
import { UNITES_AUTORISEES } from './dto/create-article.dto.js';

function makeService() {
  const prisma = {
    nomenclature: { findUnique: vi.fn().mockResolvedValue({ id: 2 }) },
    article: {
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 3, ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { service: new ArticlesService(prisma as never), prisma };
}

describe('ArticlesService règles de gestion', () => {
  it('limite les unités à nb, l, kg', () => {
    expect([...UNITES_AUTORISEES]).toEqual(['nb', 'l', 'kg']);
  });
  it('refuse un article sans nomenclature existante', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.nomenclature.findUnique).mockResolvedValue(null);
    await expect(
      service.create({ designation: 'Chaise', unite: 'pièce', nomenclatureId: 99 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuse la suppression d\'un article utilisé', async () => {
    const { service, prisma } = makeService();
    vi.mocked(prisma.article.findUnique).mockResolvedValue({
      id: 3,
      _count: { details: 1, mouvements: 0 },
    } as never);
    await expect(service.remove(3)).rejects.toBeInstanceOf(ConflictException);
  });

  it("normalise l'unité en minuscule (nb, l, kg)", async () => {
    const { service, prisma } = makeService();
    await service.create({ designation: 'Chaise', unite: 'NB', nomenclatureId: 2 });
    expect(prisma.article.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ unite: 'nb' }) }),
    );
  });
});
