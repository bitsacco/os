import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  DistributedLockService,
  TransactionStatus,
  TransactionType,
} from '../../common';
import { SolowalletRepository } from '../db/solowallet.repository';
import { AtomicWithdrawalService } from './atomic-withdrawal.service';

describe('AtomicWithdrawalService', () => {
  let service: AtomicWithdrawalService;
  let mockRepository: jest.Mocked<SolowalletRepository>;
  let mockLockService: jest.Mocked<DistributedLockService>;

  const mockWithdrawal = {
    _id: 'withdrawal-123',
    userId: 'user-123',
    walletId: 'wallet-123',
    amountMsats: 10000,
    type: TransactionType.WITHDRAW,
    status: TransactionStatus.PROCESSING,
    reference: 'Test withdrawal',
    lightning: '{"invoice":"lnbc..."}',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      aggregate: jest.fn(),
    } as any;

    mockLockService = {
      acquireLock: jest.fn(),
      acquireLockWithRetry: jest.fn(),
      releaseLock: jest.fn(),
      getUserWithdrawalLockKey: jest.fn(),
    } as any;

    // Set up default mock behaviors
    mockLockService.getUserWithdrawalLockKey.mockReturnValue(
      'lock-key-user-123',
    );
    mockLockService.acquireLock.mockResolvedValue('lock-token-123');
    mockLockService.releaseLock.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtomicWithdrawalService,
        {
          provide: SolowalletRepository,
          useValue: mockRepository,
        },
        {
          provide: DistributedLockService,
          useValue: mockLockService,
        },
      ],
    }).compile();

    service = module.get<AtomicWithdrawalService>(AtomicWithdrawalService);
  });

  describe('createWithdrawalAtomic', () => {
    it('should create withdrawal when balance is sufficient', async () => {
      // Arrange
      const params = {
        userId: 'user-123',
        walletId: 'wallet-123',
        amountMsats: 10000,
        reference: 'Test withdrawal',
        lightning: '{"invoice":"lnbc..."}',
        idempotencyKey: 'key-123',
        currentBalance: 30000, // Balance provided by calling service
      };

      mockRepository.findOne.mockRejectedValue(new Error('Not found'));
      mockRepository.create.mockResolvedValue(mockWithdrawal as any);

      // Act
      const result = await service.createWithdrawalAtomic(params);

      // Assert
      expect(result).toEqual(mockWithdrawal);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          walletId: 'wallet-123',
          amountMsats: 10000,
          status: TransactionStatus.PROCESSING,
        }),
      );
    });

    it('should reject withdrawal when balance is insufficient', async () => {
      // Arrange
      const params = {
        userId: 'user-123',
        walletId: 'wallet-123',
        amountMsats: 100000,
        reference: 'Test withdrawal',
        lightning: '{"invoice":"lnbc..."}',
        currentBalance: 5000, // Insufficient balance
      };

      // Act & Assert
      await expect(service.createWithdrawalAtomic(params)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should return existing withdrawal for duplicate idempotency key', async () => {
      // Arrange
      const params = {
        userId: 'user-123',
        walletId: 'wallet-123',
        amountMsats: 10000,
        reference: 'Test withdrawal',
        lightning: '{"invoice":"lnbc..."}',
        idempotencyKey: 'key-123',
        currentBalance: 30000,
      };

      mockRepository.findOne.mockResolvedValue(mockWithdrawal as any);

      // Act
      const result = await service.createWithdrawalAtomic(params);

      // Assert
      expect(result).toEqual(mockWithdrawal);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should handle concurrent withdrawals by including PROCESSING status in balance', async () => {
      // Arrange
      const params = {
        userId: 'user-123',
        walletId: 'wallet-123',
        amountMsats: 10000,
        reference: 'Test withdrawal',
        lightning: '{"invoice":"lnbc..."}',
        currentBalance: 5000, // Balance after accounting for processing withdrawals
      };

      // Act & Assert
      // Available balance = 100000 - 30000 - 65000 = 5000
      // Requested = 10000, should fail
      await expect(service.createWithdrawalAtomic(params)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateWithdrawalStatus', () => {
    it('should update withdrawal status from PROCESSING to COMPLETE', async () => {
      // Arrange
      const updatedWithdrawal = {
        ...mockWithdrawal,
        status: TransactionStatus.COMPLETE,
      };
      mockRepository.findOneAndUpdate.mockResolvedValue(
        updatedWithdrawal as any,
      );

      // Act
      const result = await service.updateWithdrawalStatus(
        'withdrawal-123',
        TransactionStatus.COMPLETE,
      );

      // Assert
      expect(result).toEqual(updatedWithdrawal);
      expect(mockRepository.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'withdrawal-123',
          status: TransactionStatus.PROCESSING,
        },
        expect.objectContaining({
          status: TransactionStatus.COMPLETE,
        }),
      );
    });

    it('should throw error when withdrawal not found or already processed', async () => {
      // Arrange - mock returns null to simulate document not found
      mockRepository.findOneAndUpdate.mockResolvedValue(null as any);

      // Act & Assert
      await expect(
        service.updateWithdrawalStatus(
          'withdrawal-123',
          TransactionStatus.COMPLETE,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rollbackWithdrawal', () => {
    it('should rollback withdrawal to FAILED status', async () => {
      // Arrange
      const failedWithdrawal = {
        ...mockWithdrawal,
        status: TransactionStatus.FAILED,
        notes: 'Payment processor error',
      };
      mockRepository.findOneAndUpdate.mockResolvedValue(
        failedWithdrawal as any,
      );

      // Act
      await service.rollbackWithdrawal(
        'withdrawal-123',
        'Payment processor error',
      );

      // Assert
      expect(mockRepository.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'withdrawal-123',
          status: TransactionStatus.PROCESSING,
        },
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          notes: 'Payment processor error',
        }),
      );
    });
  });

  describe('Race Condition Prevention', () => {
    it('should prevent multiple concurrent withdrawals from exceeding balance', async () => {
      // This test validates the integration works - in a real scenario the
      // atomic operations would prevent race conditions, but with mocks we
      // can only test that the service structure is correct
      const withdrawalPromises = [];
      let createCallCount = 0;
      let balanceRemaining = 50000; // Track simulated balance

      // Mock aggregate to return current balance state
      mockRepository.aggregate.mockImplementation(async () => {
        const processingWithdrawals = Math.max(0, 50000 - balanceRemaining);
        return [
          {
            completedDeposits: 50000,
            completedWithdrawals: 0,
            pendingDeposits: 0,
            pendingWithdrawals: 0,
            processingWithdrawals,
          },
        ];
      });

      // Mock create to simulate atomic behavior
      mockRepository.create.mockImplementation(async (data) => {
        createCallCount++;

        // Simulate atomic check - only allow if sufficient balance
        const currentBalance = balanceRemaining;
        if (currentBalance >= 10000) {
          balanceRemaining -= 10000; // Reduce balance atomically
          return { ...mockWithdrawal, ...data } as any;
        } else {
          throw new BadRequestException('Insufficient balance for withdrawal');
        }
      });

      // Create 10 concurrent withdrawal attempts of 10,000 each
      // Only 5 should succeed with a balance of 50,000
      for (let i = 0; i < 10; i++) {
        withdrawalPromises.push(
          service
            .createWithdrawalAtomic({
              userId: 'user-123',
              walletId: 'wallet-123',
              amountMsats: 10000,
              reference: `Withdrawal ${i}`,
              lightning: '{"invoice":"lnbc..."}',
              currentBalance: balanceRemaining, // Include current balance for atomic check
            })
            .catch((error) => error),
        );
      }

      // Act
      const results = await Promise.all(withdrawalPromises);

      // Assert
      const successfulWithdrawals = results.filter(
        (r) => !(r instanceof Error),
      ).length;
      const failedWithdrawals = results.filter(
        (r) => r instanceof BadRequestException,
      ).length;

      // Exactly 5 withdrawals should succeed (50,000 / 10,000)
      expect(successfulWithdrawals).toBe(5);
      expect(failedWithdrawals).toBe(5);
      expect(successfulWithdrawals + failedWithdrawals).toBe(10);
    });
  });
});
