import { Test, TestingModule } from '@nestjs/testing';
import { UserRequestsService } from './user-requests.service.js';

describe('UserRequestsService', () => {
  let service: UserRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserRequestsService],
    }).compile();

    service = module.get<UserRequestsService>(UserRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
