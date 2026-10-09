import { Test, TestingModule } from '@nestjs/testing';
import { DetailCompteMatieresService } from './detail-compte-matieres.service.js';

describe('DetailCompteMatieresService', () => {
  let service: DetailCompteMatieresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DetailCompteMatieresService],
    }).compile();

    service = module.get<DetailCompteMatieresService>(DetailCompteMatieresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
