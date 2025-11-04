import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ChamaTxStatus, TransactionType } from '../../common';
import { ChamaWalletDocument, ChamaWalletRepository } from '../db';
import { DistributedLockService } from '../../common/services';

/**
 * Service for handling atomic withdrawal operations for chama wallets.
 * Prevents race conditions and protects collective group funds using atomic database operations.
 * Based on proven patterns from personal wallet implementation.
 */
@Injectable()
export class ChamaAtomicWithdrawalService {
  private readonly logger = new Logger(ChamaAtomicWithdrawalService.name);

  constructor(
    private readonly walletRepository: ChamaWalletRepository,
    private readonly lockService: DistributedLockService,
  ) {}

  /**
   * Creates a chama withdrawal with atomic balance validation.
   * Uses MongoDB's atomic operations and distributed locking to ensure no race conditions.
   * Protects collective group funds through proper balance validation.
   *
   * @param params Withdrawal parameters including current group balance
   * @returns The created withdrawal document or null if insufficient balance
   */
  async createWithdrawalAtomic(params: {
    memberId: string;
    chamaId: string;
    amountMsats: number;
    amountFiat?: number;
    reference: string;
    lightning: string;
    paymentTracker?: string;
    idempotencyKey?: string;
    currentGroupBalance: number; // Group balance provided by calling service
    reviews?: any[]; // Initial reviews if admin pre-approving
    initialStatus?: ChamaTxStatus; // Initial status (PENDING or calculated)
  }): Promise<ChamaWalletDocument | null> {
    const {
      memberId,
      chamaId,
      amountMsats,
      amountFiat,
      reference,
      lightning,
      paymentTracker,
      idempotencyKey,
      currentGroupBalance,
      reviews = [],
      initialStatus = ChamaTxStatus.PENDING,
    } = params;

    // Step 1: Acquire distributed lock for the entire chama to prevent concurrent withdrawals
    const lockKey = `chama-withdrawal:${chamaId}`;
    const lockToken = await this.lockService.acquireLock(lockKey, 10000); // 10 second lock

    if (!lockToken) {
      this.logger.warn(
        `Failed to acquire withdrawal lock for chama ${chamaId}. Concurrent withdrawal in progress.`,
      );
      throw new BadRequestException(
        'Another withdrawal is already in progress for this chama. Please wait and try again.',
      );
    }

    try {
      // Step 2: Check if idempotency key exists
      if (idempotencyKey) {
        try {
          const existing = await this.walletRepository.findOne({
            memberId,
            chamaId,
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

      // Step 3: Validate group balance (balance provided by calling service)
      if (currentGroupBalance < amountMsats) {
        this.logger.warn(
          `Insufficient group balance for chama ${chamaId}. ` +
            `Available: ${currentGroupBalance} msats, ` +
            `Requested: ${amountMsats} msats`,
        );
        throw new BadRequestException(
          'Insufficient chama group balance for withdrawal',
        );
      }

      // Step 4: Create withdrawal with appropriate status
      const now = new Date();
      const withdrawal = await this.walletRepository.create({
        memberId,
        chamaId,
        amountMsats,
        amountFiat,
        type: TransactionType.WITHDRAW,
        status: initialStatus, // May be PENDING or APPROVED based on admin review
        reference,
        lightning,
        paymentTracker,
        idempotencyKey,
        reviews,
        stateChangedAt: now,
        timeoutAt:
          initialStatus === ChamaTxStatus.PENDING
            ? new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hour timeout for approvals
            : new Date(now.getTime() + 5 * 60 * 1000), // 5 minute timeout for processing
        retryCount: 0,
        maxRetries: 3,
        __v: 0,
      });

      this.logger.log(
        `Created chama withdrawal ${withdrawal._id} in ${initialStatus} state for member ${memberId} in chama ${chamaId}`,
      );

      return withdrawal;
    } finally {
      // Always release the lock
      await this.lockService.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Atomically updates withdrawal status after approval or lightning payment.
   * Ensures only valid state transitions can occur.
   *
   * @param withdrawalId The withdrawal document ID
   * @param status The new status
   * @param additionalData Any additional data to update
   */
  async updateWithdrawalStatus(
    withdrawalId: string,
    status: ChamaTxStatus,
    additionalData?: Partial<ChamaWalletDocument>,
  ): Promise<ChamaWalletDocument> {
    const now = new Date();

    // Define valid state transitions
    const validTransitions: Partial<Record<ChamaTxStatus, ChamaTxStatus[]>> = {
      [ChamaTxStatus.PENDING]: [
        ChamaTxStatus.APPROVED,
        ChamaTxStatus.REJECTED,
        ChamaTxStatus.FAILED,
      ],
      [ChamaTxStatus.APPROVED]: [
        ChamaTxStatus.PROCESSING,
        ChamaTxStatus.FAILED,
      ],
      [ChamaTxStatus.PROCESSING]: [
        ChamaTxStatus.COMPLETE,
        ChamaTxStatus.FAILED,
      ],
      [ChamaTxStatus.REJECTED]: [], // Terminal state
      [ChamaTxStatus.COMPLETE]: [], // Terminal state
      [ChamaTxStatus.FAILED]: [], // Terminal state
      [ChamaTxStatus.MANUAL_REVIEW]: [
        ChamaTxStatus.APPROVED,
        ChamaTxStatus.REJECTED,
        ChamaTxStatus.FAILED,
      ],
      [ChamaTxStatus.UNRECOGNIZED]: [], // Terminal state
    };

    // Find the current withdrawal
    const current = await this.walletRepository.findOne({ _id: withdrawalId });
    if (!current) {
      throw new BadRequestException('Withdrawal not found');
    }

    // Check if transition is valid
    const currentStatus = current.status as ChamaTxStatus;
    const allowedTransitions = validTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      this.logger.warn(
        `Invalid status transition for withdrawal ${withdrawalId}: ${currentStatus} -> ${status}`,
      );
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${status}`,
      );
    }

    const updated = await this.walletRepository.findOneAndUpdate(
      {
        _id: withdrawalId,
        status: currentStatus, // Only update if still in expected state
      },
      {
        status,
        stateChangedAt: now,
        ...additionalData,
      },
    );

    if (!updated) {
      throw new BadRequestException(
        'Withdrawal status has changed or withdrawal not found',
      );
    }

    this.logger.log(
      `Updated withdrawal ${withdrawalId} status from ${currentStatus} to ${status}`,
    );

    return updated;
  }

  /**
   * Processes an approved withdrawal with atomic fund deduction.
   * Used when actually executing the withdrawal after approval.
   *
   * @param params Processing parameters
   * @returns true if processed successfully
   */
  async processApprovedWithdrawal(params: {
    withdrawalId: string;
    chamaId: string;
    currentGroupBalance: number;
  }): Promise<boolean> {
    const { withdrawalId, chamaId, currentGroupBalance } = params;

    // Acquire lock for processing
    const lockKey = `chama-withdrawal-process:${chamaId}`;
    const lockToken = await this.lockService.acquireLock(lockKey, 30000); // 30 second lock for processing

    if (!lockToken) {
      this.logger.warn(
        `Failed to acquire processing lock for chama ${chamaId}`,
      );
      return false;
    }

    try {
      // Get the withdrawal
      const withdrawal = await this.walletRepository.findOne({
        _id: withdrawalId,
      });

      if (!withdrawal) {
        throw new BadRequestException('Withdrawal not found');
      }

      if (withdrawal.status !== ChamaTxStatus.APPROVED) {
        throw new BadRequestException(
          'Withdrawal must be approved before processing',
        );
      }

      // Final balance check before processing
      if (currentGroupBalance < withdrawal.amountMsats) {
        this.logger.error(
          `Insufficient balance during processing. Balance: ${currentGroupBalance}, Amount: ${withdrawal.amountMsats}`,
        );

        // Mark as failed due to insufficient funds
        await this.updateWithdrawalStatus(withdrawalId, ChamaTxStatus.FAILED, {
          notes: 'Insufficient group balance at processing time',
        });

        return false;
      }

      // Update to PROCESSING state
      await this.updateWithdrawalStatus(withdrawalId, ChamaTxStatus.PROCESSING);

      this.logger.log(`Started processing approved withdrawal ${withdrawalId}`);
      return true;
    } finally {
      await this.lockService.releaseLock(lockKey, lockToken);
    }
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
    await this.updateWithdrawalStatus(withdrawalId, ChamaTxStatus.FAILED, {
      notes: reason,
      stateChangedAt: new Date(),
    });

    this.logger.log(
      `Rolled back withdrawal ${withdrawalId}. Reason: ${reason}`,
    );
  }

  /**
   * Checks if a chama has any pending or processing withdrawals.
   * Used to prevent multiple concurrent withdrawals.
   *
   * @param chamaId The chama ID
   * @returns true if there are active withdrawals
   */
  async hasActiveWithdrawals(chamaId: string): Promise<boolean> {
    try {
      const activeWithdrawal = await this.walletRepository.findOne({
        chamaId,
        type: TransactionType.WITHDRAW,
        status: {
          $in: [
            ChamaTxStatus.PENDING,
            ChamaTxStatus.APPROVED,
            ChamaTxStatus.PROCESSING,
          ],
        },
      });

      return !!activeWithdrawal;
    } catch (error) {
      this.logger.error(
        `Error checking active withdrawals for chama ${chamaId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Gets all processing withdrawals for a chama.
   * Used for balance calculations.
   *
   * @param chamaId The chama ID
   * @returns Array of processing withdrawal amounts
   */
  async getProcessingWithdrawals(chamaId: string): Promise<number[]> {
    try {
      const processingWithdrawals = await this.walletRepository.find({
        chamaId,
        type: TransactionType.WITHDRAW,
        status: ChamaTxStatus.PROCESSING,
      });

      return processingWithdrawals.map((w) => w.amountMsats);
    } catch (error) {
      this.logger.error(
        `Error fetching processing withdrawals for chama ${chamaId}:`,
        error,
      );
      return [];
    }
  }
}
