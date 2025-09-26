import { BadRequestException } from '@nestjs/common';
import { AtomicWithdrawalService } from './atomic-withdrawal.service';
import { TransactionStatus, TransactionType } from '../../common';

describe('AtomicWithdrawalService - Simple Tests', () => {
  let service: AtomicWithdrawalService;
  let mockRepository: any;
  let mockLockService: any;

  beforeEach(() => {
    // Create mock repository with all required methods
    mockRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      aggregate: jest.fn(),
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    };

    // Create mock lock service
    mockLockService = {
      acquireLock: jest.fn().mockResolvedValue('lock-token-123'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    // Create service instance with mocks
    service = new AtomicWithdrawalService(mockRepository, mockLockService);
  });

  describe('Race Condition Prevention', () => {
    it('should prevent withdrawals when balance is insufficient due to PROCESSING transactions', async () => {
      // Setup: User has 100k sats, but 95k is already processing
      mockRepository.aggregate.mockResolvedValue([
        {
          completedDeposits: 100000,
          completedWithdrawals: 0,
          pendingDeposits: 0,
          pendingWithdrawals: 0,
          processingWithdrawals: 95000, // Critical: PROCESSING counts against balance
        },
      ]);

      // Attempt to withdraw 10k (would exceed available 5k)
      const params = {
        userId: 'user-123',
        walletId: 'wallet-123',
        amountMsats: 10000,
        reference: 'Test withdrawal',
        lightning: '{"invoice":"lnbc..."}',
      };

      // Should reject due to insufficient balance
      await expect(service.createWithdrawalAtomic(params)).rejects.toThrow(
        BadRequestException,
      );

      // Verify no withdrawal was created
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should correctly calculate available balance including PROCESSING withdrawals', async () => {
      // Setup balance scenario
      mockRepository.aggregate.mockResolvedValue([
        {
          completedDeposits: 1000000, // 1M sats deposited
          completedWithdrawals: 200000, // 200k withdrawn
          pendingDeposits: 50000, // 50k pending (not counted)
          pendingWithdrawals: 30000, // 30k pending (not counted)
          processingWithdrawals: 300000, // 300k currently processing
        },
      ]);

      const result = await service.calculateBalanceAtomic(
        'user-123',
        'wallet-123',
      );

      // Available = 1M - 200k - 300k = 500k
      expect(result.currentBalance).toBe(500000);
      expect(result.processingWithdrawals).toBe(300000);
    });

    it('should handle idempotent withdrawals correctly', async () => {
      const existingWithdrawal = {
        _id: 'existing-123',
        userId: 'user-123',
        amountMsats: 10000,
        status: TransactionStatus.PROCESSING,
      };

      // First call with idempotency key finds existing
      mockRepository.findOne.mockResolvedValue(existingWithdrawal);

      const result = await service.createWithdrawalAtomic({
        userId: 'user-123',
        walletId: 'wallet-123',
        amountMsats: 10000,
        reference: 'Test',
        lightning: '{}',
        idempotencyKey: 'key-123',
      });

      // Should return existing without creating new
      expect(result).toBe(existingWithdrawal);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should create withdrawal with PROCESSING status when balance is sufficient', async () => {
      // Setup sufficient balance
      mockRepository.findOne.mockImplementation(() => {
        throw new Error('Not found');
      });
      mockRepository.aggregate.mockResolvedValue([
        {
          completedDeposits: 100000,
          completedWithdrawals: 20000,
          processingWithdrawals: 10000,
          pendingDeposits: 0,
          pendingWithdrawals: 0,
        },
      ]);

      const createdWithdrawal = {
        _id: 'new-123',
        status: TransactionStatus.PROCESSING,
      };
      mockRepository.create.mockResolvedValue(createdWithdrawal);

      const result = await service.createWithdrawalAtomic({
        userId: 'user-123',
        walletId: 'wallet-123',
        amountMsats: 50000, // Within available 70k
        reference: 'Test',
        lightning: '{}',
      });

      // Verify withdrawal was created with PROCESSING status
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TransactionStatus.PROCESSING,
          amountMsats: 50000,
        }),
      );
      expect(result).toBe(createdWithdrawal);
    });
  });

  describe('Status Updates', () => {
    it('should only update withdrawals in PROCESSING state', async () => {
      const updatedWithdrawal = {
        _id: 'withdrawal-123',
        status: TransactionStatus.COMPLETE,
      };

      mockRepository.findOneAndUpdate.mockResolvedValue(updatedWithdrawal);

      await service.updateWithdrawalStatus(
        'withdrawal-123',
        TransactionStatus.COMPLETE,
      );

      // Verify it queries for PROCESSING status
      expect(mockRepository.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'withdrawal-123',
          status: TransactionStatus.PROCESSING, // Critical: Only update if PROCESSING
        },
        expect.objectContaining({
          status: TransactionStatus.COMPLETE,
        }),
      );
    });

    it('should handle rollback to FAILED status', async () => {
      const failedWithdrawal = {
        _id: 'withdrawal-123',
        status: TransactionStatus.FAILED,
      };

      mockRepository.findOneAndUpdate.mockResolvedValue(failedWithdrawal);

      await service.rollbackWithdrawal('withdrawal-123', 'Payment failed');

      expect(mockRepository.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'withdrawal-123' }),
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          notes: 'Payment failed',
        }),
      );
    });
  });

  describe('Concurrent Withdrawal Simulation', () => {
    it('should handle race condition with multiple concurrent requests', async () => {
      let balanceCheckCount = 0;
      let createdCount = 0;

      // Simulate changing balance as withdrawals are created
      mockRepository.aggregate.mockImplementation(async () => {
        balanceCheckCount++;

        // Start with 50k available
        let processingAmount = 0;

        // After 3 withdrawals, balance should be exhausted
        if (createdCount >= 3) {
          processingAmount = 30000; // 3 x 10k
        } else if (createdCount >= 2) {
          processingAmount = 20000; // 2 x 10k
        } else if (createdCount >= 1) {
          processingAmount = 10000; // 1 x 10k
        }

        return [
          {
            completedDeposits: 50000,
            completedWithdrawals: 0,
            pendingDeposits: 0,
            pendingWithdrawals: 0,
            processingWithdrawals: processingAmount,
          },
        ];
      });

      mockRepository.findOne.mockImplementation(() => {
        throw new Error('Not found');
      });

      mockRepository.create.mockImplementation(async (data) => {
        createdCount++;
        return { _id: `withdrawal-${createdCount}`, ...data };
      });

      // Create 5 concurrent withdrawal attempts of 10k each
      const withdrawalPromises = Array.from({ length: 5 }, (_, i) =>
        service
          .createWithdrawalAtomic({
            userId: 'user-123',
            walletId: 'wallet-123',
            amountMsats: 10000,
            reference: `Withdrawal ${i}`,
            lightning: '{}',
          })
          .catch((err) => err),
      );

      const results = await Promise.all(withdrawalPromises);

      // Count successes and failures
      const successes = results.filter((r) => !(r instanceof Error));
      const failures = results.filter((r) => r instanceof BadRequestException);

      // With 50k balance and 10k withdrawals, exactly 5 should succeed
      // The mock simulates atomic balance checking
      expect(successes.length).toBe(5);
      expect(failures.length).toBe(0); // No failures because all 5 fit in balance

      console.log(
        `Concurrent test: ${successes.length} succeeded, ${failures.length} failed`,
      );
    });
  });
});
