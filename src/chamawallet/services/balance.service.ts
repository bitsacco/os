import { Injectable, Logger } from '@nestjs/common';
import { ChamaTxStatus, TransactionType } from '../../common';
import { ChamaWalletRepository } from '../db';

/**
 * Service for calculating and managing chama wallet balances.
 * Provides accurate group and member balance calculations including processing transactions.
 * Based on proven balance calculation patterns from personal wallet.
 */
@Injectable()
export class ChamaBalanceService {
  private readonly logger = new Logger(ChamaBalanceService.name);

  constructor(private readonly walletRepository: ChamaWalletRepository) {}

  /**
   * Gets comprehensive wallet metadata for a chama group.
   * Includes total deposits, withdrawals, and available balance.
   * CRITICAL: Includes processing withdrawals in balance calculation to prevent overdrafts.
   *
   * @param chamaId The chama ID
   * @returns Group wallet metadata
   */
  async getGroupWalletMeta(chamaId: string): Promise<{
    groupDeposits: number;
    groupWithdrawals: number;
    processingWithdrawals: number;
    groupBalance: number;
  }> {
    try {
      // Calculate total deposits (all completed deposits)
      const groupDeposits = await this.aggregateTransactions(
        chamaId,
        TransactionType.DEPOSIT,
        [ChamaTxStatus.COMPLETE],
      );

      // Calculate total withdrawals (all completed withdrawals)
      const groupWithdrawals = await this.aggregateTransactions(
        chamaId,
        TransactionType.WITHDRAW,
        [ChamaTxStatus.COMPLETE],
      );

      // Calculate processing withdrawals (pending execution)
      // This is critical for preventing overdrafts
      const processingWithdrawals = await this.aggregateTransactions(
        chamaId,
        TransactionType.WITHDRAW,
        [ChamaTxStatus.PROCESSING],
      );

      // Available balance = deposits - completed withdrawals - processing withdrawals
      const groupBalance =
        groupDeposits - groupWithdrawals - processingWithdrawals;

      this.logger.debug(
        `Group balance for chama ${chamaId}: ` +
          `Deposits: ${groupDeposits}, ` +
          `Withdrawals: ${groupWithdrawals}, ` +
          `Processing: ${processingWithdrawals}, ` +
          `Balance: ${groupBalance}`,
      );

      return {
        groupDeposits,
        groupWithdrawals,
        processingWithdrawals,
        groupBalance,
      };
    } catch (error) {
      this.logger.error(
        `Error calculating group balance for chama ${chamaId}:`,
        error,
      );
      return {
        groupDeposits: 0,
        groupWithdrawals: 0,
        processingWithdrawals: 0,
        groupBalance: 0,
      };
    }
  }

  /**
   * Gets wallet metadata for a specific member within a chama.
   * Includes member's contributions and withdrawals.
   *
   * @param chamaId The chama ID
   * @param memberId The member ID
   * @returns Member wallet metadata
   */
  async getMemberWalletMeta(
    chamaId: string,
    memberId: string,
  ): Promise<{
    memberDeposits: number;
    memberWithdrawals: number;
    processingWithdrawals: number;
    memberBalance: number;
  }> {
    try {
      // Calculate member's total deposits
      const memberDeposits = await this.aggregateTransactions(
        chamaId,
        TransactionType.DEPOSIT,
        [ChamaTxStatus.COMPLETE],
        memberId,
      );

      // Calculate member's total withdrawals
      const memberWithdrawals = await this.aggregateTransactions(
        chamaId,
        TransactionType.WITHDRAW,
        [ChamaTxStatus.COMPLETE],
        memberId,
      );

      // Calculate member's processing withdrawals
      const processingWithdrawals = await this.aggregateTransactions(
        chamaId,
        TransactionType.WITHDRAW,
        [ChamaTxStatus.PROCESSING],
        memberId,
      );

      // Member's net contribution = deposits - withdrawals - processing
      const memberBalance =
        memberDeposits - memberWithdrawals - processingWithdrawals;

      this.logger.debug(
        `Member balance for ${memberId} in chama ${chamaId}: ` +
          `Deposits: ${memberDeposits}, ` +
          `Withdrawals: ${memberWithdrawals}, ` +
          `Processing: ${processingWithdrawals}, ` +
          `Balance: ${memberBalance}`,
      );

      return {
        memberDeposits,
        memberWithdrawals,
        processingWithdrawals,
        memberBalance,
      };
    } catch (error) {
      this.logger.error(
        `Error calculating member balance for ${memberId} in chama ${chamaId}:`,
        error,
      );
      return {
        memberDeposits: 0,
        memberWithdrawals: 0,
        processingWithdrawals: 0,
        memberBalance: 0,
      };
    }
  }

  /**
   * Gets combined wallet metadata for both group and member.
   *
   * @param chamaId The chama ID
   * @param memberId Optional member ID
   * @returns Combined wallet metadata
   */
  async getWalletMeta(
    chamaId: string,
    memberId?: string,
  ): Promise<{
    groupMeta: {
      groupDeposits: number;
      groupWithdrawals: number;
      groupBalance: number;
    };
    memberMeta?: {
      memberDeposits: number;
      memberWithdrawals: number;
      memberBalance: number;
    };
  }> {
    const groupMetaData = await this.getGroupWalletMeta(chamaId);

    // Prepare group meta (without processingWithdrawals in the response for backward compatibility)
    const groupMeta = {
      groupDeposits: groupMetaData.groupDeposits,
      groupWithdrawals: groupMetaData.groupWithdrawals,
      groupBalance: groupMetaData.groupBalance, // This already accounts for processing withdrawals
    };

    if (!memberId) {
      return { groupMeta };
    }

    const memberMetaData = await this.getMemberWalletMeta(chamaId, memberId);

    // Prepare member meta (without processingWithdrawals in the response for backward compatibility)
    const memberMeta = {
      memberDeposits: memberMetaData.memberDeposits,
      memberWithdrawals: memberMetaData.memberWithdrawals,
      memberBalance: memberMetaData.memberBalance, // This already accounts for processing withdrawals
    };

    return { groupMeta, memberMeta };
  }

  /**
   * Aggregates transactions by type and status using atomic database operations.
   * Core method for accurate balance calculations.
   *
   * @param chamaId The chama ID
   * @param type Transaction type (DEPOSIT or WITHDRAW)
   * @param statuses Array of statuses to include
   * @param memberId Optional member ID for member-specific aggregation
   * @returns Total amount in msats
   */
  private async aggregateTransactions(
    chamaId: string,
    type: TransactionType,
    statuses: ChamaTxStatus[],
    memberId?: string,
  ): Promise<number> {
    try {
      const filter: any = {
        chamaId,
        type: type.toString(),
        status: { $in: statuses.map((s) => s.toString()) },
      };

      if (memberId) {
        filter.memberId = memberId;
      }

      const statusLabel = statuses.join(', ');
      this.logger.debug(
        `Aggregating ${type} transactions for chama ${chamaId}` +
          `${memberId ? ` member ${memberId}` : ''} with status [${statusLabel}]`,
      );

      // Use MongoDB aggregation for atomic calculation
      const result = await this.walletRepository.model.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountMsats' },
          },
        },
      ]);

      const total = result.length > 0 ? result[0].total : 0;

      this.logger.debug(
        `Aggregated ${type} [${statusLabel}]: ${total} msats` +
          `${memberId ? ` for member ${memberId}` : ''} in chama ${chamaId}`,
      );

      return total;
    } catch (error) {
      this.logger.error(
        `Error aggregating ${type} transactions for chama ${chamaId}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Validates if a withdrawal amount can be safely processed.
   * Checks both group balance and considers pending/processing transactions.
   *
   * @param chamaId The chama ID
   * @param amountMsats The withdrawal amount
   * @returns Validation result with current balance
   */
  async validateWithdrawalAmount(
    chamaId: string,
    amountMsats: number,
  ): Promise<{
    isValid: boolean;
    currentBalance: number;
    reason?: string;
  }> {
    const { groupBalance } = await this.getGroupWalletMeta(chamaId);

    if (groupBalance < amountMsats) {
      return {
        isValid: false,
        currentBalance: groupBalance,
        reason: `Insufficient balance. Available: ${groupBalance} msats, Requested: ${amountMsats} msats`,
      };
    }

    return {
      isValid: true,
      currentBalance: groupBalance,
    };
  }

  /**
   * Gets pending withdrawals for a chama that need approval.
   *
   * @param chamaId The chama ID
   * @returns Array of pending withdrawals
   */
  async getPendingWithdrawals(chamaId: string): Promise<any[]> {
    try {
      return await this.walletRepository.find({
        chamaId,
        type: TransactionType.WITHDRAW,
        status: ChamaTxStatus.PENDING,
      });
    } catch (error) {
      this.logger.error(
        `Error fetching pending withdrawals for chama ${chamaId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Gets approved withdrawals awaiting processing.
   *
   * @param chamaId The chama ID
   * @returns Array of approved withdrawals
   */
  async getApprovedWithdrawals(chamaId: string): Promise<any[]> {
    try {
      return await this.walletRepository.find({
        chamaId,
        type: TransactionType.WITHDRAW,
        status: ChamaTxStatus.APPROVED,
      });
    } catch (error) {
      this.logger.error(
        `Error fetching approved withdrawals for chama ${chamaId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Calculates the total amount locked in pending and processing withdrawals.
   * Used to understand fund commitments.
   *
   * @param chamaId The chama ID
   * @returns Total locked amount in msats
   */
  async getLockedFunds(chamaId: string): Promise<number> {
    try {
      const pendingAmount = await this.aggregateTransactions(
        chamaId,
        TransactionType.WITHDRAW,
        [ChamaTxStatus.PENDING, ChamaTxStatus.APPROVED],
      );

      const processingAmount = await this.aggregateTransactions(
        chamaId,
        TransactionType.WITHDRAW,
        [ChamaTxStatus.PROCESSING],
      );

      const total = pendingAmount + processingAmount;

      this.logger.debug(
        `Locked funds for chama ${chamaId}: ${total} msats ` +
          `(Pending/Approved: ${pendingAmount}, Processing: ${processingAmount})`,
      );

      return total;
    } catch (error) {
      this.logger.error(
        `Error calculating locked funds for chama ${chamaId}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Gets transaction statistics for reporting.
   *
   * @param chamaId The chama ID
   * @returns Transaction statistics
   */
  async getTransactionStats(chamaId: string): Promise<{
    totalTransactions: number;
    deposits: {
      count: number;
      total: number;
    };
    withdrawals: {
      count: number;
      total: number;
      pending: number;
      processing: number;
    };
  }> {
    try {
      const [
        depositCount,
        withdrawalCount,
        depositTotal,
        withdrawalTotal,
        pendingWithdrawals,
        processingWithdrawals,
      ] = await Promise.all([
        this.walletRepository.model.countDocuments({
          chamaId,
          type: TransactionType.DEPOSIT,
          status: ChamaTxStatus.COMPLETE,
        }),
        this.walletRepository.model.countDocuments({
          chamaId,
          type: TransactionType.WITHDRAW,
          status: ChamaTxStatus.COMPLETE,
        }),
        this.aggregateTransactions(chamaId, TransactionType.DEPOSIT, [
          ChamaTxStatus.COMPLETE,
        ]),
        this.aggregateTransactions(chamaId, TransactionType.WITHDRAW, [
          ChamaTxStatus.COMPLETE,
        ]),
        this.aggregateTransactions(chamaId, TransactionType.WITHDRAW, [
          ChamaTxStatus.PENDING,
          ChamaTxStatus.APPROVED,
        ]),
        this.aggregateTransactions(chamaId, TransactionType.WITHDRAW, [
          ChamaTxStatus.PROCESSING,
        ]),
      ]);

      return {
        totalTransactions: depositCount + withdrawalCount,
        deposits: {
          count: depositCount,
          total: depositTotal,
        },
        withdrawals: {
          count: withdrawalCount,
          total: withdrawalTotal,
          pending: pendingWithdrawals,
          processing: processingWithdrawals,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error calculating transaction stats for chama ${chamaId}:`,
        error,
      );
      return {
        totalTransactions: 0,
        deposits: { count: 0, total: 0 },
        withdrawals: { count: 0, total: 0, pending: 0, processing: 0 },
      };
    }
  }
}
