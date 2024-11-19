import { Test, TestingModule } from '@nestjs/testing';
import { NostrService } from './nostr.service';

describe('NostrService', () => {
  let service: NostrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NostrService],
    }).compile();

    service = module.get<NostrService>(NostrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
