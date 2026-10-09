import { Test, TestingModule } from '@nestjs/testing';
import { CompteMatieresController } from './compte-matieres.controller.js';
import { CompteMatieresModule } from './compte-matieres.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('CompteMatieresController', () => {
  let controller: CompteMatieresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CompteMatieresModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    controller = module.get<CompteMatieresController>(CompteMatieresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
