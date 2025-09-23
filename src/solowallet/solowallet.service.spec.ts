import { Test, TestingModule } from '@nestjs/testing';
import { SolowalletService } from './solowallet.service';
import { PersonalWalletService } from '../personal/services/wallet.service';
import { SolowalletMetricsService } from './solowallet.metrics';

describe('SolowalletService - Main Operations', () => {
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delegate continueDepositFunds to PersonalWalletService', async () => {
    const mockResponse = { userId: 'test-user', ledger: { transactions: [] } };
    personalWalletService.continueDepositFunds.mockResolvedValue(mockResponse);

    const result = await service.continueDepositFunds({
      userId: 'test-user',
      txId: 'test-tx',
      amountFiat: 1000,
      reference: 'test-ref',
    });

    expect(personalWalletService.continueDepositFunds).toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });

  it('should delegate continueWithdrawFunds to PersonalWalletService', async () => {
    const mockResponse = { userId: 'test-user', ledger: { transactions: [] } };
    personalWalletService.continueWithdrawFunds.mockResolvedValue(mockResponse);

    const result = await service.continueWithdrawFunds({
      userId: 'test-user',
      txId: 'test-tx',
      amountFiat: 500,
      reference: 'test-ref',
    });

    expect(personalWalletService.continueWithdrawFunds).toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });
});
