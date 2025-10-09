import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { SolowalletRepository } from '../db';
import { TransactionStatus, TransactionType } from '../../common';

/**
 * PersonalMetricsService provides metrics for personal wallets
 * This is a replacement for the removed SolowalletMetricsService
 */
@Injectable()
export class PersonalMetricsService {
  private readonly logger = new Logger(PersonalMetricsService.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly solowalletRepository: SolowalletRepository,
  ) {
    this.logger.log('PersonalMetricsService initialized');
  }

  /**
   * Get total balance across all wallets for a user
   */
  async getTotalBalance(userId: string): Promise<number> {
    const summary = await this.analyticsService.getPortfolioSummary(userId);
    return summary.totalBalance;
  }

  /**
   * Get transaction count statistics
   */
  async getTransactionStats(): Promise<{
    total: number;
    deposits: number;
    withdrawals: number;
  }> {
    const [total, deposits, withdrawals] = await Promise.all([
      this.solowalletRepository.countDocuments({}),
      this.solowalletRepository.countDocuments({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETE,
      }),
      this.solowalletRepository.countDocuments({
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.COMPLETE,
      }),
    ]);

    return { total, deposits, withdrawals };
  }

  /**
   * Get active users count
   */
  async getActiveUsersCount(since: Date): Promise<number> {
    const result = await this.solowalletRepository.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          status: TransactionStatus.COMPLETE,
        },
      },
      {
        $group: {
          _id: '$userId',
        },
      },
      {
        $count: 'totalUsers',
      },
    ]);
    return result[0]?.totalUsers || 0;
  }

  /**
   * Get total volume
   */
  async getTotalVolume(since?: Date): Promise<number> {
    const filter: any = {
      status: TransactionStatus.COMPLETE,
    };

    if (since) {
      filter.createdAt = { $gte: since };
    }

    const result = await this.solowalletRepository.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalVolume: {
            $sum: {
              $cond: [
                { $eq: ['$type', TransactionType.DEPOSIT] },
                '$amountMsats',
                0,
              ],
            },
          },
        },
      },
    ]);

    return result[0]?.totalVolume || 0;
  }

  /**
   * Get metrics summary
   */
  async getMetricsSummary(): Promise<{
    totalUsers: number;
    totalTransactions: number;
    totalVolume: number;
    averageBalance: number;
  }> {
    const [userCount, txStats, totalVolume] = await Promise.all([
      this.getUserCount(),
      this.getTransactionStats(),
      this.getTotalVolume(),
    ]);

    const averageBalance = userCount > 0 ? totalVolume / userCount : 0;

    return {
      totalUsers: userCount,
      totalTransactions: txStats.total,
      totalVolume,
      averageBalance,
    };
  }

  /**
   * Get total user count
   */
  private async getUserCount(): Promise<number> {
    const result = await this.solowalletRepository.aggregate([
      {
        $group: {
          _id: '$userId',
        },
      },
      {
        $count: 'totalUsers',
      },
    ]);
    return result[0]?.totalUsers || 0;
  }
}
