import { UserRequestsController } from './user-requests.controller.js';
import { UserRequestsService } from './user-requests.service.js';

describe('UserRequestsController', () => {
  it('should be defined', () => {
    const prisma = { userRequest: { create: vi.fn() } };
    const mailService = {
      sendNewUserRequestNotification: vi.fn(),
    };
    const service = new UserRequestsService(
      prisma as never,
      mailService as never,
    );
    const controller = new UserRequestsController(service);
    expect(controller).toBeDefined();
  });
});
