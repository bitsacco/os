import { Test, TestingModule } from '@nestjs/testing';
import { SolowalletService } from './solowallet.service';
import { SolowalletRepository } from './db';
import {
  FedimintService,
  TransactionStatus,
  TransactionType,
  TimeoutConfigService,
} from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SolowalletMetricsService } from './solowallet.metrics';
import { SwapService } from '../swap/swap.service';
import { ConfigService } from '@nestjs/config';

describe('SolowalletService - Generalized Aggregation', () => {
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
        {
          provide: TimeoutConfigService,
          useValue: {
            calculateTimeoutDate: jest.fn().mockReturnValue(new Date()),
            getConfig: jest.fn().mockReturnValue({
              pendingTimeoutMinutes: 15,
              processingTimeoutMinutes: 30,
              maxRetries: 3,
              depositTimeoutMinutes: 15,
              withdrawalTimeoutMinutes: 30,
              lnurlTimeoutMinutes: 30,
              offrampTimeoutMinutes: 15,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SolowalletService>(SolowalletService);
    walletRepository = module.get(SolowalletRepository);
  });

  describe('aggregateTransactionsByStatus', () => {
    const userId = 'test-user-id';

    it('should aggregate transactions with single status', async () => {
      walletRepository.aggregate.mockResolvedValueOnce([{ totalMsats: 5000 }]);

      const result = await (service as any).aggregateTransactionsByStatus(
        userId,
        TransactionType.WITHDRAW,
        TransactionStatus.PROCESSING,
      );

      expect(result).toBe(5000);
      expect(walletRepository.aggregate).toHaveBeenCalledWith([
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

    it('should aggregate transactions with multiple statuses', async () => {
      walletRepository.aggregate.mockResolvedValueOnce([{ totalMsats: 8000 }]);

      const result = await (service as any).aggregateTransactionsByStatus(
        userId,
        TransactionType.WITHDRAW,
        [TransactionStatus.PENDING, TransactionStatus.PROCESSING],
      );

      expect(result).toBe(8000);
      expect(walletRepository.aggregate).toHaveBeenCalledWith([
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

    it('should handle empty aggregation results', async () => {
      walletRepository.aggregate.mockResolvedValueOnce([]);

      const result = await (service as any).aggregateTransactionsByStatus(
        userId,
        TransactionType.DEPOSIT,
        TransactionStatus.COMPLETE,
      );

      expect(result).toBe(0);
    });

    it('should handle aggregation errors gracefully', async () => {
      walletRepository.aggregate.mockRejectedValueOnce(new Error('DB Error'));

      const result = await (service as any).aggregateTransactionsByStatus(
        userId,
        TransactionType.WITHDRAW,
        TransactionStatus.PROCESSING,
      );

      expect(result).toBe(0);
    });
  });

  describe('method delegation', () => {
    const userId = 'test-user-id';

    it('aggregateUserTransactions should delegate to aggregateTransactionsByStatus with COMPLETE status', async () => {
      const spy = jest.spyOn(service as any, 'aggregateTransactionsByStatus');
      walletRepository.aggregate.mockResolvedValueOnce([{ totalMsats: 10000 }]);

      await (service as any).aggregateUserTransactions(
        userId,
        TransactionType.DEPOSIT,
      );

      expect(spy).toHaveBeenCalledWith(
        userId,
        TransactionType.DEPOSIT,
        TransactionStatus.COMPLETE,
      );
    });

    it('aggregateProcessingTransactions should delegate to aggregateTransactionsByStatus with PROCESSING status', async () => {
      const spy = jest.spyOn(service as any, 'aggregateTransactionsByStatus');
      walletRepository.aggregate.mockResolvedValueOnce([{ totalMsats: 3000 }]);

      await (service as any).aggregateProcessingTransactions(
        userId,
        TransactionType.WITHDRAW,
      );

      expect(spy).toHaveBeenCalledWith(
        userId,
        TransactionType.WITHDRAW,
        TransactionStatus.PROCESSING,
      );
    });
  });
});
