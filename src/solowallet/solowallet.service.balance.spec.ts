import { Test, TestingModule } from '@nestjs/testing';
import { SolowalletService } from './solowallet.service';
import { PersonalWalletService } from '../personal/services/wallet.service';
import { SolowalletMetricsService } from './solowallet.metrics';
import { DepositFundsRequestDto, UserTxsResponse, WalletMeta } from '../common';

describe('SolowalletService - Balance Calculations', () => {
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

  describe('userTransactions', () => {
    const userId = 'test-user-id';

    it('should delegate to PersonalWalletService and record metrics', async () => {
      const mockResponse: UserTxsResponse = {
        userId,
        ledger: {
          transactions: [],
          page: 0,
          size: 20,
          pages: 0,
        },
        meta: {
          totalDeposits: 10000,
          totalWithdrawals: 3000,
          currentBalance: 7000,
        },
      };

      personalWalletService.userTransactions.mockResolvedValue(mockResponse);

      const result = await service.userTransactions({ userId });

      expect(personalWalletService.userTransactions).toHaveBeenCalledWith({
        userId,
      });
      expect(metricsService.recordBalanceMetric).toHaveBeenCalledWith({
        userId,
        balanceMsats: 7000,
        activity: 'query',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle missing balance metadata', async () => {
      const mockResponse: UserTxsResponse = {
        userId,
        ledger: {
          transactions: [],
          page: 0,
          size: 20,
          pages: 0,
        },
        meta: undefined,
      };

      personalWalletService.userTransactions.mockResolvedValue(mockResponse);

      const result = await service.userTransactions({ userId });

      expect(metricsService.recordBalanceMetric).toHaveBeenCalledWith({
        userId,
        balanceMsats: 0,
        activity: 'query',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('depositFunds', () => {
    const userId = 'test-user-id';

    it('should delegate to PersonalWalletService and record success metrics', async () => {
      const depositRequest: DepositFundsRequestDto = {
        userId,
        amountFiat: 1000,
        reference: 'test-deposit',
      };

      const mockResponse: UserTxsResponse = {
        userId,
        ledger: {
          transactions: [],
          page: 0,
          size: 20,
          pages: 0,
        },
        meta: {
          totalDeposits: 11000,
          totalWithdrawals: 3000,
          currentBalance: 8000,
        },
      };

      personalWalletService.depositToWallet.mockResolvedValue(mockResponse);

      const result = await service.depositFunds(depositRequest);

      expect(
        personalWalletService.getLegacyDefaultWalletId,
      ).toHaveBeenCalledWith('test-user-id');
      expect(personalWalletService.depositToWallet).toHaveBeenCalledWith({
        ...depositRequest,
        walletId: 'default-wallet-id',
        walletType: expect.any(String),
      });
      expect(metricsService.recordDepositMetric).toHaveBeenCalledWith({
        userId,
        amountMsats: 0,
        amountFiat: 1000,
        method: 'lightning',
        success: true,
        duration: expect.any(Number),
      });
      expect(metricsService.recordBalanceMetric).toHaveBeenCalledWith({
        userId,
        balanceMsats: 8000,
        activity: 'deposit',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should record failure metrics when deposit fails', async () => {
      const depositRequest: DepositFundsRequestDto = {
        userId,
        amountFiat: 1000,
        reference: 'test-deposit',
      };

      const error = new Error('Deposit failed');
      personalWalletService.depositToWallet.mockRejectedValue(error);

      await expect(service.depositFunds(depositRequest)).rejects.toThrow(
        'Deposit failed',
      );

      expect(metricsService.recordDepositMetric).toHaveBeenCalledWith({
        userId,
        amountMsats: 0,
        amountFiat: 1000,
        method: 'lightning',
        success: false,
        duration: expect.any(Number),
        errorType: 'Deposit failed',
      });
      expect(metricsService.recordBalanceMetric).not.toHaveBeenCalled();
    });
  });
});
