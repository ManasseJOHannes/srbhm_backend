import { Test, TestingModule } from '@nestjs/testing';
import { ExercicesController } from './exercices.controller.js';
import { ExercicesModule } from './exercices.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ExercicesController', () => {
  let controller: ExercicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ExercicesModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    controller = module.get<ExercicesController>(ExercicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
