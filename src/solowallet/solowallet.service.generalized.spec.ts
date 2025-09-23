import { Test, TestingModule } from '@nestjs/testing';
import { SolowalletService } from './solowallet.service';
import { PersonalWalletService } from '../personal/services/wallet.service';
import { SolowalletMetricsService } from './solowallet.metrics';

describe('SolowalletService - Generalized Operations', () => {
  let service: SolowalletService;
  let personalWalletService: any;
  let metricsService: any;

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
    metricsService = module.get(SolowalletMetricsService);
  });

  describe('delegation behavior', () => {
    it('should delegate withdrawFunds to PersonalWalletService', async () => {
      const mockResponse = {
        userId: 'test-user',
        ledger: { transactions: [] },
      };
      personalWalletService.withdrawFromWallet.mockResolvedValue(mockResponse);

      const result = await service.withdrawFunds({
        userId: 'test-user',
        amountFiat: 500,
        reference: 'test-withdrawal',
      });

      expect(
        personalWalletService.getLegacyDefaultWalletId,
      ).toHaveBeenCalledWith('test-user');
      expect(personalWalletService.withdrawFromWallet).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should delegate findTransaction to PersonalWalletService', async () => {
      const mockTransaction = { id: 'test-tx-id', userId: 'test-user' };
      personalWalletService.findTransaction.mockResolvedValue(mockTransaction);

      const result = await service.findTransaction({
        txId: 'test-tx-id',
        userId: 'test-user',
      });

      expect(personalWalletService.findTransaction).toHaveBeenCalledWith({
        txId: 'test-tx-id',
        userId: 'test-user',
      });
      expect(result).toEqual(mockTransaction);
    });
  });
});
