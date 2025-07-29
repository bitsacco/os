import { Test, TestingModule } from '@nestjs/testing';
import { SolowalletService } from './solowallet.service';
import { SolowalletRepository } from './db';
import { FedimintService, TransactionStatus, TransactionType } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LnurlMetricsService } from '../common/monitoring/lnurl.metrics';
import { SolowalletMetricsService } from './solowallet.metrics';
import { SwapService } from '../swap/swap.service';
import { ConfigService } from '@nestjs/config';

describe('SolowalletService - Balance Calculations', () => {
  let service: SolowalletService;
  let walletRepository: jest.Mocked<SolowalletRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolowalletService,
        {
          provide: SolowalletRepository,
          useValue: {
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
            findOneAndUpdateWithVersion: jest.fn(),
            create: jest.fn(),
            find: jest.fn(),
            aggregate: jest.fn(),
          },
        },
        {
          provide: FedimintService,
          useValue: {
            initialize: jest.fn(),
            invoice: jest.fn(),
            decode: jest.fn(),
            pay: jest.fn(),
            receive: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            on: jest.fn(),
            emit: jest.fn(),
          },
        },
        {
          provide: LnurlMetricsService,
          useValue: {
            recordWithdrawalMetric: jest.fn(),
          },
        },
        {
          provide: SolowalletMetricsService,
          useValue: {
            recordDepositMetric: jest.fn(),
            recordWithdrawalMetric: jest.fn(),
            recordBalanceMetric: jest.fn(),
          },
        },
        {
          provide: SwapService,
          useValue: {
            getQuote: jest.fn(),
            createOnrampSwap: jest.fn(),
            createOfframpSwap: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SolowalletService>(SolowalletService);
    walletRepository = module.get(SolowalletRepository);
  });

  describe('getWalletMeta', () => {
    const userId = 'test-user-id';

    it('should calculate balance excluding pending withdrawals', async () => {
      // Mock completed transactions
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 10000 }]) // Total deposits
        .mockResolvedValueOnce([{ totalMsats: 3000 }])  // Total completed withdrawals
        .mockResolvedValueOnce([{ totalMsats: 2000 }]); // Pending withdrawals

      const meta = await (service as any).getWalletMeta(userId);

      expect(meta).toEqual({
        totalDeposits: 10000,
        totalWithdrawals: 3000,
        currentBalance: 5000, // 10000 - 3000 - 2000
      });

      // Verify aggregation queries
      expect(walletRepository.aggregate).toHaveBeenCalledTimes(3);
      
      // Check deposit aggregation
      expect(walletRepository.aggregate).toHaveBeenNthCalledWith(1, [
        {
          $match: {
            userId,
            status: TransactionStatus.COMPLETE.toString(),
            type: TransactionType.DEPOSIT.toString(),
          },
        },
        {
          $group: {
            _id: null,
            totalMsats: { $sum: '$amountMsats' },
          },
        },
      ]);

      // Check completed withdrawal aggregation
      expect(walletRepository.aggregate).toHaveBeenNthCalledWith(2, [
        {
          $match: {
            userId,
            status: TransactionStatus.COMPLETE.toString(),
            type: TransactionType.WITHDRAW.toString(),
          },
        },
        {
          $group: {
            _id: null,
            totalMsats: { $sum: '$amountMsats' },
          },
        },
      ]);

      // Check pending withdrawal aggregation
      expect(walletRepository.aggregate).toHaveBeenNthCalledWith(3, [
        {
          $match: {
            userId,
            status: {
              $in: [
                TransactionStatus.PENDING.toString(),
                TransactionStatus.PROCESSING.toString(),
              ],
            },
            type: TransactionType.WITHDRAW.toString(),
          },
        },
        {
          $group: {
            _id: null,
            totalMsats: { $sum: '$amountMsats' },
          },
        },
      ]);
    });

    it('should handle zero pending withdrawals', async () => {
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 10000 }]) // Total deposits
        .mockResolvedValueOnce([{ totalMsats: 3000 }])  // Total completed withdrawals
        .mockResolvedValueOnce([]);                      // No pending withdrawals

      const meta = await (service as any).getWalletMeta(userId);

      expect(meta).toEqual({
        totalDeposits: 10000,
        totalWithdrawals: 3000,
        currentBalance: 7000, // 10000 - 3000 - 0
      });
    });

    it('should handle empty aggregation results', async () => {
      walletRepository.aggregate
        .mockResolvedValueOnce([])  // No deposits
        .mockResolvedValueOnce([])  // No withdrawals
        .mockResolvedValueOnce([]);  // No pending

      const meta = await (service as any).getWalletMeta(userId);

      expect(meta).toEqual({
        totalDeposits: 0,
        totalWithdrawals: 0,
        currentBalance: 0,
      });
    });

    it('should prevent withdrawal when pending withdrawals would exceed balance', async () => {
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 10000 }]) // Total deposits
        .mockResolvedValueOnce([{ totalMsats: 3000 }])  // Total completed withdrawals
        .mockResolvedValueOnce([{ totalMsats: 6000 }]); // Large pending withdrawal

      const meta = await (service as any).getWalletMeta(userId);

      expect(meta.currentBalance).toBe(1000); // Only 1000 sats available
    });
  });
});