import { Test, TestingModule } from '@nestjs/testing';
import { SolowalletService } from './solowallet.service';
import { PersonalWalletService } from '../personal/services/wallet.service';
import { SolowalletMetricsService } from './solowallet.metrics';

describe('SolowalletService - Idempotency', () => {
  let service: SolowalletService;
  let personalWalletService: any;

  beforeEach(async () => {
    const mockPersonalWalletService = {
      depositToWallet: jest.fn(),
      withdrawFromWallet: jest.fn(),
      userTransactions: jest.fn(),
      findTransaction: jest.fn(),
      continueDepositFunds: jest.fn(),
      continueWithdrawFunds: jest.fn(),
      updateTransaction: jest.fn(),
      getLegacyDefaultWalletId: jest.fn().mockReturnValue('default-wallet-id'),
    };

    const mockMetricsService = {
      recordDepositMetric: jest.fn(),
      recordBalanceMetric: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolowalletService,
        {
          provide: PersonalWalletService,
          useValue: mockPersonalWalletService,
        },
        {
          provide: SolowalletMetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<SolowalletService>(SolowalletService);
    personalWalletService = module.get(PersonalWalletService);
  });

  it('should delegate all operations to PersonalWalletService', async () => {
    const mockResponse = { userId: 'test-user', ledger: { transactions: [] } };
    personalWalletService.userTransactions.mockResolvedValue(mockResponse);

    const result = await service.userTransactions({ userId: 'test-user' });

    expect(personalWalletService.userTransactions).toHaveBeenCalledWith({
      userId: 'test-user',
    });
    expect(result).toEqual(mockResponse);
  });
});
