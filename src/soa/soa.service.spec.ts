import { Test, TestingModule } from '@nestjs/testing';
import { SoaService } from './soa.service.js';

describe('SoaService', () => {
  let service: SoaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SoaService],
    }).compile();

    service = module.get<SoaService>(SoaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
