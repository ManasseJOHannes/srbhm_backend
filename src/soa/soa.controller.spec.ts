import { Test, TestingModule } from '@nestjs/testing';
import { SoaController } from './soa.controller.js';
import { SoaService } from './soa.service.js';

describe('SoaController', () => {
  let controller: SoaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SoaController],
      providers: [SoaService],
    }).compile();

    controller = module.get<SoaController>(SoaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
