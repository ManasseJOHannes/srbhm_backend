import { UserRequestsService } from './user-requests.service.js';

describe('UserRequestsService', () => {
  const makeService = () => {
    const prisma = {
      userRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args: never) =>
          Promise.resolve({
            id: 1,
            createdAt: new Date(),
            ...(args as { data: object }).data,
            soa: { code: 'SOA-01', libelle: 'Test' },
          }),
        ),
      },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      sOA: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 1, actif: true }),
      },
    };
    const mailService = {
      sendNewUserRequestNotification: vi.fn().mockResolvedValue(undefined),
    };
    const service = new UserRequestsService(
      prisma as never,
      mailService as never,
    );
    return { service, prisma, mailService };
  };

  it('should be defined', () => {
    const { service } = makeService();
    expect(service).toBeDefined();
  });

  it('notifie l’admin par email après une création', async () => {
    const { service, mailService } = makeService();

    await service.create({
      imatricule: 'MEF-001',
      nom: 'RAKOTO',
      prenom: 'Mamy',
      cin: '101',
      telephone: '0340000000',
      soaId: 1,
      role: 'COMPTABLE',
      adresse: 'Tana',
      email: 'a@b.mg',
    } as never);

    expect(
      mailService.sendNewUserRequestNotification,
    ).toHaveBeenCalledTimes(1);
  });
});
