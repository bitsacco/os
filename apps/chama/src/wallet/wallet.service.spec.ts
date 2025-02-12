import { Test, TestingModule } from '@nestjs/testing';
import { ChamaWalletService } from './wallet.service';

describe('ChamaWalletService', () => {
  let service: ChamaWalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChamaWalletService],
    }).compile();

    service = module.get<ChamaWalletService>(ChamaWalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
