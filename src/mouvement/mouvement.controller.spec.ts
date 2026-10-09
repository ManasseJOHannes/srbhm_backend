import { Test, TestingModule } from '@nestjs/testing';
import { MouvementController } from './mouvement.controller.js';
import { MouvementService } from './mouvement.service.js';

describe('MouvementController', () => {
  let controller: MouvementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MouvementController],
      providers: [MouvementService],
    }).compile();

    controller = module.get<MouvementController>(MouvementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
