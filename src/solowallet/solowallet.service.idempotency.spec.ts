import { Test, TestingModule } from '@nestjs/testing';
import { SolowalletService } from './solowallet.service';
import { SolowalletRepository } from './db';
import { FedimintService, TransactionStatus, TransactionType } from '../common';
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
          useValue: {},
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

      // Mock balance aggregations
      walletRepository.aggregate
        .mockResolvedValueOnce([{ totalMsats: 10000 }]) // deposits
        .mockResolvedValueOnce([{ totalMsats: 2000 }])  // withdrawals
        .mockResolvedValueOnce([{ totalMsats: 0 }]);    // pending

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
      
      // Mock not finding any transaction (since no idempotency key)
      walletRepository.findOne.mockRejectedValueOnce(new Error('Not found'));

      const result = await service.withdrawFunds({
        userId: mockUserId,
        amountFiat: 100,
        reference: 'Test withdrawal',
        // No idempotencyKey provided
      });

      // Verify it didn't check for existing transaction
      expect(walletRepository.findOne).not.toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: expect.anything(),
        })
      );
    });
  });
});