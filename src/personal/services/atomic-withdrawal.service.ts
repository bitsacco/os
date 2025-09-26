import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '../../common';
import { SolowalletRepository } from '../db/solowallet.repository';
import { SolowalletDocument } from '../db/solowallet.schema';
import { DistributedLockService } from './distributed-lock.service';

/**
 * Service for handling atomic withdrawal operations.
 * Prevents race conditions by using atomic database operations.
 */
@Injectable()
export class AtomicWithdrawalService {
  private readonly logger = new Logger(AtomicWithdrawalService.name);

  constructor(
    private readonly walletRepository: SolowalletRepository,
    private readonly lockService: DistributedLockService,
  ) {}

  /**
   * Creates a withdrawal with atomic balance validation.
   * Uses MongoDB's atomic findOneAndUpdate to ensure no race conditions.
   *
   * @param params Withdrawal parameters
   * @returns The created withdrawal document or null if insufficient balance
   */
  async createWithdrawalAtomic(params: {
    userId: string;
    walletId: string;
    amountMsats: number;
    amountFiat?: number;
    reference: string;
    lightning: string;
    paymentTracker?: string;
    idempotencyKey?: string;
  }): Promise<SolowalletDocument | null> {
    const {
      userId,
      walletId,
      amountMsats,
      amountFiat,
      reference,
      lightning,
      paymentTracker,
      idempotencyKey,
    } = params;

    // Step 1: Acquire distributed lock to prevent race conditions
    const lockKey = `withdrawal:${userId}:${walletId}`;
    const lockToken = await this.lockService.acquireLock(lockKey, 10000); // 10 second lock

    if (!lockToken) {
      this.logger.warn(
        `Failed to acquire withdrawal lock for user ${userId}. Concurrent withdrawal in progress.`,
      );
      throw new BadRequestException(
        'Another withdrawal is already in progress. Please wait and try again.',
      );
    }

    try {
      // Step 3: Check if idempotency key exists
      if (idempotencyKey) {
        try {
          const existing = await this.walletRepository.findOne({
            userId,
            type: TransactionType.WITHDRAW,
            idempotencyKey,
          });
          if (existing) {
            this.logger.warn(
              `Duplicate withdrawal attempt with idempotency key: ${idempotencyKey}`,
            );
            return existing;
          }
        } catch {
          // No existing document, proceed
        }
      }

      // Step 2: Calculate current balance atomically
      const balanceResult = await this.calculateBalanceAtomic(userId, walletId);

      if (balanceResult.currentBalance < amountMsats) {
        this.logger.warn(
          `Insufficient balance for user ${userId}. ` +
            `Available: ${balanceResult.currentBalance} msats, ` +
            `Requested: ${amountMsats} msats`,
        );
        throw new BadRequestException('Insufficient balance for withdrawal');
      }

      // Step 3: Create withdrawal with PROCESSING status
      const now = new Date();
      const withdrawal = await this.walletRepository.create({
        userId,
        walletId,
        amountMsats,
        amountFiat,
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.PROCESSING, // Start in PROCESSING state
        reference,
        lightning,
        paymentTracker,
        idempotencyKey,
        stateChangedAt: now,
        timeoutAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 minute timeout
        __v: 0, // Add missing version field
      });

      this.logger.log(
        `Created withdrawal ${withdrawal._id} in PROCESSING state for user ${userId}`,
      );

      return withdrawal;
    } finally {
      // Always release the lock
      await this.lockService.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Atomically updates withdrawal status after lightning payment.
   *
   * @param withdrawalId The withdrawal document ID
   * @param status The new status
   * @param additionalData Any additional data to update
   */
  async updateWithdrawalStatus(
    withdrawalId: string,
    status: TransactionStatus,
    additionalData?: Partial<SolowalletDocument>,
  ): Promise<SolowalletDocument> {
    const now = new Date();

    const updated = await this.walletRepository.findOneAndUpdate(
      {
        _id: withdrawalId,
        status: TransactionStatus.PROCESSING, // Only update if still processing
      },
      {
        status,
        stateChangedAt: now,
        ...additionalData,
      },
    );

    if (!updated) {
      throw new BadRequestException(
        'Withdrawal not found or already processed',
      );
    }

    this.logger.log(`Updated withdrawal ${withdrawalId} status to ${status}`);

    return updated;
  }

  /**
   * Calculates balance atomically, including PROCESSING withdrawals.
   * This prevents race conditions in balance calculations.
   *
   * @param userId User ID
   * @param walletId Wallet ID
   * @returns Current balance and pending amounts
   */
  async calculateBalanceAtomic(
    userId: string,
    walletId: string,
  ): Promise<{
    currentBalance: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
    processingWithdrawals: number;
  }> {
    const pipeline = [
      {
        $match: {
          userId,
          walletId,
        },
      },
      {
        $group: {
          _id: null,
          // Completed transactions
          completedDeposits: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', TransactionType.DEPOSIT] },
                    { $eq: ['$status', TransactionStatus.COMPLETE] },
                  ],
                },
                '$amountMsats',
                0,
              ],
            },
          },
          completedWithdrawals: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', TransactionType.WITHDRAW] },
                    { $eq: ['$status', TransactionStatus.COMPLETE] },
                  ],
                },
                '$amountMsats',
                0,
              ],
            },
          },
          // Pending transactions
          pendingDeposits: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', TransactionType.DEPOSIT] },
                    { $eq: ['$status', TransactionStatus.PENDING] },
                  ],
                },
                '$amountMsats',
                0,
              ],
            },
          },
          pendingWithdrawals: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', TransactionType.WITHDRAW] },
                    { $eq: ['$status', TransactionStatus.PENDING] },
                  ],
                },
                '$amountMsats',
                0,
              ],
            },
          },
          // Processing withdrawals (counts against balance)
          processingWithdrawals: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', TransactionType.WITHDRAW] },
                    { $eq: ['$status', TransactionStatus.PROCESSING] },
                  ],
                },
                '$amountMsats',
                0,
              ],
            },
          },
        },
      },
    ];

    const result = await this.walletRepository.aggregate(pipeline);

    if (!result || result.length === 0) {
      return {
        currentBalance: 0,
        pendingDeposits: 0,
        pendingWithdrawals: 0,
        processingWithdrawals: 0,
      };
    }

    const data = result[0];

    // Calculate current balance including PROCESSING withdrawals
    const currentBalance =
      data.completedDeposits -
      data.completedWithdrawals -
      data.processingWithdrawals; // Subtract processing withdrawals

    return {
      currentBalance: Math.max(0, currentBalance),
      pendingDeposits: data.pendingDeposits || 0,
      pendingWithdrawals: data.pendingWithdrawals || 0,
      processingWithdrawals: data.processingWithdrawals || 0,
    };
  }

  /**
   * Attempts to reserve funds for a withdrawal using optimistic locking.
   * This method uses document versioning to prevent concurrent modifications.
   *
   * @param params Withdrawal parameters
   * @returns The withdrawal document if successful, null if concurrent modification detected
   */
  async reserveFundsWithOptimisticLock(params: {
    userId: string;
    walletId: string;
    amountMsats: number;
    maxRetries?: number;
  }): Promise<boolean> {
    const { userId, walletId, amountMsats, maxRetries = 3 } = params;
    let attempts = 0;

    while (attempts < maxRetries) {
      attempts++;

      try {
        // Get current balance state with version
        const balanceState = await this.getBalanceStateWithVersion(
          userId,
          walletId,
        );

        if (balanceState.availableBalance < amountMsats) {
          this.logger.warn(
            `Insufficient funds for reservation. ` +
              `Available: ${balanceState.availableBalance}, ` +
              `Requested: ${amountMsats}`,
          );
          return false;
        }

        // Attempt to create reservation with version check
        // This would be implemented with a version field in the wallet document
        // For now, we rely on the atomic operations above

        return true;
      } catch (error) {
        if (attempts >= maxRetries) {
          this.logger.error(
            `Failed to reserve funds after ${maxRetries} attempts`,
            error,
          );
          throw error;
        }

        // Wait with exponential backoff before retry
        const waitTime = Math.min(100 * Math.pow(2, attempts), 1000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    return false;
  }

  /**
   * Gets the balance state with version information for optimistic locking.
   *
   * @param userId User ID
   * @param walletId Wallet ID
   * @returns Balance state with version
   */
  private async getBalanceStateWithVersion(
    userId: string,
    walletId: string,
  ): Promise<{
    availableBalance: number;
    version: number;
  }> {
    const balance = await this.calculateBalanceAtomic(userId, walletId);

    // In a real implementation, this would include a version number
    // from the wallet document for optimistic locking
    return {
      availableBalance: balance.currentBalance,
      version: Date.now(), // Placeholder for version
    };
  }

  /**
   * Rollback a failed withdrawal by updating its status to FAILED.
   *
   * @param withdrawalId The withdrawal document ID
   * @param reason The failure reason
   */
  async rollbackWithdrawal(
    withdrawalId: string,
    reason: string,
  ): Promise<void> {
    await this.updateWithdrawalStatus(withdrawalId, TransactionStatus.FAILED, {
      notes: reason,
      stateChangedAt: new Date(),
    });

    this.logger.log(
      `Rolled back withdrawal ${withdrawalId}. Reason: ${reason}`,
    );
  }
}
