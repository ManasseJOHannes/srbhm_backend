import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: ReturnType<typeof vi.fn>;
    me: ReturnType<typeof vi.fn>;
    updateMe: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authService = {
      login: vi.fn(),
      me: vi.fn(),
      updateMe: vi.fn(),
      changePassword: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe()', () => {
    it('délègue au service avec l’id de l’utilisateur authentifié', () => {
      authService.me.mockReturnValue({ id: 7 });

      controller.getMe({
        id: 7,
        role: 'COMPTABLE',
        imatricule: 'EMP-0007',
        email: 'a@b.mg',
      } as never);

      expect(authService.me).toHaveBeenCalledWith(7);
    });
  });

  describe('updateMe()', () => {
    it('délègue au service avec l’id de l’utilisateur, pas celui du corps', () => {
      controller.updateMe(
        { id: 7, role: 'COMPTABLE', imatricule: 'E', email: 'a@b.mg' } as never,
        { adresse: 'Fianarantsoa' },
      );

      expect(authService.updateMe).toHaveBeenCalledWith(7, {
        adresse: 'Fianarantsoa',
      });
    });
  });

  describe('changePassword()', () => {
    it('délègue au service avec l’id de l’utilisateur', () => {
      controller.changePassword(
        { id: 7, role: 'COMPTABLE', imatricule: 'E', email: 'a@b.mg' } as never,
        { currentPassword: 'a', newPassword: 'b' },
      );

      expect(authService.changePassword).toHaveBeenCalledWith(7, {
        currentPassword: 'a',
        newPassword: 'b',
      });
    });
  });
});