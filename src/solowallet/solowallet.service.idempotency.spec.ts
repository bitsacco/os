import { Test, TestingModule } from '@nestjs/testing';
import { SolowalletService } from './solowallet.service';
import { SolowalletRepository } from './db';
import {
  FedimintService,
  TransactionStatus,
  TransactionType,
  Currency,
  TimeoutConfigService,
} from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LnurlMetricsService } from '../common/monitoring/lnurl.metrics';
import { SolowalletMetricsService } from './solowallet.metrics';
import { SwapService } from '../swap/swap.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

describe('SolowalletService - Idempotency', () => {
  let service: SolowalletService;
  let walletRepository: jest.Mocked<SolowalletRepository>;

  const mockUserId = uuidv4();
  const mockTxId = uuidv4();
  const mockIdempotencyKey = 'test-withdraw-12345';

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
            decode: jest.fn().mockResolvedValue({
              amountMsats: 10000000000, // 10B msats
            }),
            pay: jest.fn().mockResolvedValue({
              operationId: 'test-operation-id',
              fee: 1000,
            }),
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
          useValue: {},
        },
        {
          provide: SolowalletMetricsService,
          useValue: {},
        },
        {
          provide: SwapService,
          useValue: {
            getQuote: jest.fn().mockResolvedValue({
              rate: 1000,
              id: 'test-quote-id',
            }),
            createOfframpSwap: jest.fn().mockResolvedValue({
              id: 'test-swap-id',
              status: TransactionStatus.PENDING,
              lightning: 'lnbc10000000p1psn5n8', // mock lightning invoice
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
          },
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

  describe('idempotency key handling', () => {
    it('should check for existing transaction with idempotency key', async () => {
      const existingTx = {
        _id: mockTxId,
        userId: mockUserId,
        type: TransactionType.WITHDRAW,
        idempotencyKey: mockIdempotencyKey,
        status: TransactionStatus.PENDING,
        amountMsats: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock finding existing transaction
      walletRepository.findOne.mockResolvedValueOnce(existingTx);

      // Mock pagination data
      walletRepository.find.mockResolvedValueOnce([existingTx]);

      // Mock balance aggregations - ensure sufficient balance
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 1000000 }]) // deposits (1M msats)
        .mockResolvedValueOnce([{ totalMsats: 2000 }]) // withdrawals
        .mockResolvedValueOnce([{ totalMsats: 0 }]); // pending

      const result = await service.withdrawFunds({
        userId: mockUserId,
        amountFiat: 100,
        reference: 'Test withdrawal',
        idempotencyKey: mockIdempotencyKey,
      });

      // Verify it checked for existing transaction
      expect(walletRepository.findOne).toHaveBeenCalledWith({
        userId: mockUserId,
        type: TransactionType.WITHDRAW,
        idempotencyKey: mockIdempotencyKey,
      });

      // Verify it returned the existing transaction
      expect(result.txId).toBe(mockTxId);

      // Verify it didn't create a new transaction
      expect(walletRepository.create).not.toHaveBeenCalled();
    });

    it('should continue with new transaction when no idempotency key provided', async () => {
      // This test verifies that withdrawals without idempotency keys
      // are not affected by the idempotency check

      const newTxId = uuidv4();

      // Mock balance aggregations - ensure sufficient balance
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 20000000000 }]) // deposits (20B msats)
        .mockResolvedValueOnce([{ totalMsats: 2000 }]) // withdrawals
        .mockResolvedValueOnce([{ totalMsats: 0 }]); // pending

      // Mock create for new transaction
      walletRepository.create.mockResolvedValueOnce({
        _id: newTxId,
        userId: mockUserId,
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.PENDING,
        amountMsats: 1000,
        amountFiat: 100,
        reference: 'Test withdrawal',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock pagination - need to return the created transaction
      walletRepository.find.mockImplementation(({ userId }) => {
        if (userId === mockUserId) {
          return Promise.resolve([
            {
              _id: newTxId,
              userId: mockUserId,
              type: TransactionType.WITHDRAW,
              status: TransactionStatus.PENDING,
              amountMsats: 10000000000,
              amountFiat: 100,
              reference: 'Test withdrawal',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.withdrawFunds({
        userId: mockUserId,
        amountFiat: 100,
        reference: 'Test withdrawal',
        // No idempotencyKey provided
        offramp: {
          provider: 'test-provider',
          providerId: 'test-id',
          currency: 'KES',
          target: {
            type: 'mobile',
            mobile: '254712345678',
          },
        },
      });

      // Verify it didn't check for existing transaction with idempotency key
      expect(walletRepository.findOne).not.toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: expect.anything(),
        }),
      );

      // Verify it created a new transaction
      expect(walletRepository.create).toHaveBeenCalled();
      expect(result.txId).toBe(newTxId);
    });
  });
});
