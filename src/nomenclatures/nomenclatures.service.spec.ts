import { Test, TestingModule } from '@nestjs/testing';
import { NomenclaturesService } from './nomenclatures.service.js';

describe('NomenclaturesService', () => {
  let service: NomenclaturesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NomenclaturesService],
    }).compile();

    service = module.get<NomenclaturesService>(NomenclaturesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
