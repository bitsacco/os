import { Test, TestingModule } from '@nestjs/testing';
import { SolowalletService } from './solowallet.service';
import { SolowalletRepository } from './db';
import { TransactionStatus, TransactionType, FedimintService } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LnurlMetricsService } from '../common/monitoring/lnurl.metrics';
import { SolowalletMetricsService } from './solowallet.metrics';
import { SwapService } from '../swap/swap.service';
import { ConfigService } from '@nestjs/config';

describe('SolowalletService - Balance Reserve', () => {
  let service: SolowalletService;
  let walletRepository: jest.Mocked<SolowalletRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolowalletService,
        {
          provide: SolowalletRepository,
          useValue: {
            aggregate: jest.fn(),
          },
        },
        {
          provide: FedimintService,
          useValue: { initialize: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { on: jest.fn() },
        },
        {
          provide: LnurlMetricsService,
          useValue: {},
        },
        {
          provide: SolowalletMetricsService,
          useValue: {},
        },
        {
          provide: SwapService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SolowalletService>(SolowalletService);
    walletRepository = module.get(SolowalletRepository);
  });

  describe('balance reserve mechanism', () => {
    const userId = 'test-user-id';

    it('should prevent withdrawal when processing withdrawals would cause negative balance', async () => {
      // User has 10000 sats deposited, 2000 withdrawn, 5000 processing
      // Available balance should be 10000 - 2000 - 5000 = 3000
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 10000 }]) // Total deposits
        .mockResolvedValueOnce([{ totalMsats: 2000 }]) // Completed withdrawals
        .mockResolvedValueOnce([{ totalMsats: 5000 }]); // Processing withdrawals

      const meta = await (service as any).getWalletMeta(userId);

      expect(meta.currentBalance).toBe(3000);
      // User can only withdraw 3000 more, not 8000 (10000 - 2000)
    });

    it('should allow withdrawal when balance is sufficient after considering processing', async () => {
      // User has 10000 sats deposited, 2000 withdrawn, 1000 processing
      // Available balance should be 10000 - 2000 - 1000 = 7000
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 10000 }]) // Total deposits
        .mockResolvedValueOnce([{ totalMsats: 2000 }]) // Completed withdrawals
        .mockResolvedValueOnce([{ totalMsats: 1000 }]); // Pending withdrawals

      const meta = await (service as any).getWalletMeta(userId);

      expect(meta.currentBalance).toBe(7000);
      // User can withdraw up to 7000 sats
    });

    it('should handle multiple processing withdrawals correctly', async () => {
      // Simulate multiple processing withdrawals
      // User has 50000 sats deposited, 10000 withdrawn
      // Multiple processing: 5000 + 3000 + 2000 = 10000 total processing
      // Available: 50000 - 10000 - 10000 = 30000
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 50000 }]) // Total deposits
        .mockResolvedValueOnce([{ totalMsats: 10000 }]) // Completed withdrawals
        .mockResolvedValueOnce([{ totalMsats: 10000 }]); // Sum of processing withdrawals

      const meta = await (service as any).getWalletMeta(userId);

      expect(meta.currentBalance).toBe(30000);
    });

    it('should show zero balance when processing equals available', async () => {
      // User has 10000 sats deposited, 5000 withdrawn, 5000 processing
      // Available balance should be 10000 - 5000 - 5000 = 0
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 10000 }]) // Total deposits
        .mockResolvedValueOnce([{ totalMsats: 5000 }]) // Completed withdrawals
        .mockResolvedValueOnce([{ totalMsats: 5000 }]); // Pending withdrawals

      const meta = await (service as any).getWalletMeta(userId);

      expect(meta.currentBalance).toBe(0);
      // User cannot make any more withdrawals
    });

    it('should include PROCESSING status in processing calculations', async () => {
      // Verify the aggregation query includes only PROCESSING status
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 10000 }])
        .mockResolvedValueOnce([{ totalMsats: 2000 }])
        .mockResolvedValueOnce([{ totalMsats: 1000 }]);

      await (service as any).getWalletMeta(userId);

      // Check the third call (processing aggregation) includes only PROCESSING status
      expect(walletRepository.aggregate).toHaveBeenNthCalledWith(3, [
        {
          $match: {
            userId,
            status: TransactionStatus.PROCESSING.toString(),
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
  });
});
