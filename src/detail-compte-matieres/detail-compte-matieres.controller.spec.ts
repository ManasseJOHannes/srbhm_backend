import { Test, TestingModule } from '@nestjs/testing';
import { DetailCompteMatieresController } from './detail-compte-matieres.controller.js';
import { DetailCompteMatieresService } from './detail-compte-matieres.service.js';

describe('DetailCompteMatieresController', () => {
  let controller: DetailCompteMatieresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DetailCompteMatieresController],
      providers: [DetailCompteMatieresService],
    }).compile();

    controller = module.get<DetailCompteMatieresController>(DetailCompteMatieresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
