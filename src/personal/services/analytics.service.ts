import { Injectable, Logger } from '@nestjs/common';
import { WalletType, TransactionType, TransactionStatus } from '../../common';
import { SolowalletRepository } from '../../solowallet/db';
import { PersonalWalletService } from './personal-wallet.service';
import {
  WalletAnalyticsResponseDto,
  WalletBreakdownDto,
  GrowthTrendDto,
  GoalStatisticsDto,
  AnalyticsQueryDto,
} from '../dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly solowalletRepository: SolowalletRepository,
    private readonly personalWalletService: PersonalWalletService,
  ) {
    this.logger.log('AnalyticsService initialized');
  }

  /**
   * Get comprehensive wallet analytics for user
   */
  async getWalletAnalytics(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<WalletAnalyticsResponseDto> {
    const [
      totalBalance,
      portfolioDistribution,
      walletBreakdown,
      growthTrends,
      goalStatistics,
    ] = await Promise.all([
      this.calculateTotalBalance(userId),
      this.calculatePortfolioDistribution(userId),
      query.includeBreakdown !== false
        ? this.getWalletBreakdown(userId)
        : undefined,
      query.includeTrends ? this.getGrowthTrends(userId) : undefined,
      query.includeGoals !== false ? this.getGoalStatistics(userId) : undefined,
    ]);

    const averageMonthlyGrowth = growthTrends
      ? this.calculateAverageMonthlyGrowth(growthTrends)
      : 0;
    const goalCompletionRate = goalStatistics
      ? this.calculateGoalCompletionRate(goalStatistics)
      : 0;

    const analytics: WalletAnalyticsResponseDto = {
      totalBalance: totalBalance.total,
      totalSavings: totalBalance.target + totalBalance.locked,
      totalLocked: totalBalance.locked,
      totalTargets: totalBalance.target,
      averageMonthlyGrowth,
      goalCompletionRate,
      portfolioDistribution,
      walletBreakdown,
      growthTrends,
      goalStatistics,
    };

    this.logger.log(
      `Generated analytics for user ${userId}: ${totalBalance.total} msats total`,
    );

    return analytics;
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(
    userId: string,
  ): Promise<{ totalBalance: number; distribution: any }> {
    const totalBalance = await this.calculateTotalBalance(userId);
    const distribution = await this.calculatePortfolioDistribution(userId);

    return {
      totalBalance: totalBalance.total,
      distribution,
    };
  }

  /**
   * Get savings rate analysis
   */
  async getSavingsRateAnalysis(
    userId: string,
    days: number = 30,
  ): Promise<{
    averageDailySavings: number;
    totalDeposits: number;
    totalWithdrawals: number;
    netSavings: number;
    savingsRate: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $match: {
          userId,
          createdAt: { $gte: startDate },
          status: TransactionStatus.COMPLETE,
          walletId: { $exists: true },
          type: { $in: [TransactionType.DEPOSIT, TransactionType.WITHDRAW] },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amountMsats' },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await this.solowalletRepository.aggregate(pipeline);

    let totalDeposits = 0;
    let totalWithdrawals = 0;

    results.forEach((result) => {
      if (result._id === TransactionType.DEPOSIT) {
        totalDeposits = result.total;
      } else if (result._id === TransactionType.WITHDRAW) {
        totalWithdrawals = Math.abs(result.total); // Withdrawals are negative
      }
    });

    const netSavings = totalDeposits - totalWithdrawals;
    const averageDailySavings = netSavings / days;
    const savingsRate =
      totalDeposits > 0 ? (netSavings / totalDeposits) * 100 : 0;

    return {
      averageDailySavings,
      totalDeposits,
      totalWithdrawals,
      netSavings,
      savingsRate,
    };
  }

  /**
   * Get goal achievement forecast
   */
  async getGoalForecast(userId: string): Promise<{
    achievableGoals: number;
    totalGoals: number;
    forecastAccuracy: number;
    projectedCompletions: any[];
  }> {
    const targetWallets = await this.solowalletRepository.find({
      userId,
      walletType: WalletType.TARGET,
      type: TransactionType.WALLET_CREATION,
    });

    const savingsAnalysis = await this.getSavingsRateAnalysis(userId);
    const projectedCompletions = [];
    let achievableGoals = 0;

    for (const wallet of targetWallets) {
      if (!wallet.targetAmountMsats || !wallet.targetDate) continue;

      const balance = await this.personalWalletService.getWalletBalance(
        userId,
        wallet.walletId!,
      );
      const remainingAmount = Math.max(0, wallet.targetAmountMsats - balance);
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (wallet.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      );

      const requiredDailySavings =
        daysRemaining > 0 ? remainingAmount / daysRemaining : 0;
      const isAchievable =
        savingsAnalysis.averageDailySavings >= requiredDailySavings;

      if (isAchievable) achievableGoals++;

      const projectedDays =
        savingsAnalysis.averageDailySavings > 0
          ? Math.ceil(remainingAmount / savingsAnalysis.averageDailySavings)
          : Infinity;

      const projectedDate =
        projectedDays < Infinity
          ? new Date(Date.now() + projectedDays * 24 * 60 * 60 * 1000)
          : null;

      projectedCompletions.push({
        walletId: wallet.walletId,
        walletName: wallet.walletName || 'Unnamed Target',
        targetDate: wallet.targetDate,
        projectedDate,
        isAchievable,
        requiredDailySavings,
        remainingAmount,
        daysRemaining,
      });
    }

    const forecastAccuracy =
      targetWallets.length > 0
        ? (achievableGoals / targetWallets.length) * 100
        : 100;

    return {
      achievableGoals,
      totalGoals: targetWallets.length,
      forecastAccuracy,
      projectedCompletions,
    };
  }

  /**
   * Private helper methods
   */
  private async calculateTotalBalance(userId: string): Promise<{
    total: number;
    standard: number;
    target: number;
    locked: number;
  }> {
    const pipeline = [
      {
        $match: {
          userId,
          status: TransactionStatus.COMPLETE,
          walletId: { $exists: true },
        },
      },
      {
        $group: {
          _id: {
            walletId: '$walletId',
            walletType: '$walletType',
          },
          balance: {
            $sum: {
              $cond: [
                { $eq: ['$type', TransactionType.DEPOSIT] },
                '$amountMsats',
                { $multiply: ['$amountMsats', -1] },
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.walletType',
          totalBalance: { $sum: '$balance' },
          walletCount: { $sum: 1 },
        },
      },
    ];

    const results = await this.solowalletRepository.aggregate(pipeline);

    const balances = {
      total: 0,
      standard: 0,
      target: 0,
      locked: 0,
    };

    results.forEach((result) => {
      const walletType = result._id || WalletType.STANDARD;
      const balance = Math.max(0, result.totalBalance); // Only count positive balances

      balances.total += balance;

      switch (walletType) {
        case WalletType.STANDARD:
          balances.standard += balance;
          break;
        case WalletType.TARGET:
          balances.target += balance;
          break;
        case WalletType.LOCKED:
          balances.locked += balance;
          break;
      }
    });

    return balances;
  }

  private async calculatePortfolioDistribution(userId: string): Promise<{
    standard: number;
    target: number;
    locked: number;
  }> {
    const balances = await this.calculateTotalBalance(userId);

    if (balances.total === 0) {
      return { standard: 0, target: 0, locked: 0 };
    }

    return {
      standard: (balances.standard / balances.total) * 100,
      target: (balances.target / balances.total) * 100,
      locked: (balances.locked / balances.total) * 100,
    };
  }

  private async getWalletBreakdown(
    userId: string,
  ): Promise<WalletBreakdownDto[]> {
    const wallets = await this.solowalletRepository.find({
      userId,
      type: TransactionType.WALLET_CREATION,
      walletId: { $exists: true },
    });

    const totalBalance = (await this.calculateTotalBalance(userId)).total;
    const breakdown: WalletBreakdownDto[] = [];

    for (const wallet of wallets) {
      const balance = await this.personalWalletService.getWalletBalance(
        userId,
        wallet.walletId!,
      );

      if (balance <= 0) continue; // Skip empty wallets

      const portfolioPercentage =
        totalBalance > 0 ? (balance / totalBalance) * 100 : 0;

      const walletBreakdown: WalletBreakdownDto = {
        walletId: wallet.walletId!,
        walletName: wallet.walletName || `${wallet.walletType} Wallet`,
        walletType: wallet.walletType || WalletType.STANDARD,
        balance,
        portfolioPercentage,
      };

      // Add type-specific information
      if (wallet.walletType === WalletType.TARGET && wallet.targetAmountMsats) {
        walletBreakdown.progressPercentage = Math.min(
          (balance / wallet.targetAmountMsats) * 100,
          100,
        );
      } else if (
        wallet.walletType === WalletType.LOCKED &&
        wallet.lockEndDate
      ) {
        const daysUntilUnlock = Math.max(
          0,
          Math.ceil(
            (wallet.lockEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        );
        walletBreakdown.daysUntilUnlock = daysUntilUnlock;
      }

      breakdown.push(walletBreakdown);
    }

    return breakdown.sort((a, b) => b.balance - a.balance); // Sort by balance descending
  }

  private async getGrowthTrends(
    userId: string,
    days: number = 90,
  ): Promise<GrowthTrendDto[]> {
    // This is a simplified implementation
    // In a real scenario, you might store daily balance snapshots or calculate from transaction history

    // const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get weekly snapshots as an approximation
    const trends: GrowthTrendDto[] = [];
    const weeklyIntervals = Math.min(12, Math.ceil(days / 7)); // Max 12 data points

    for (let i = 0; i < weeklyIntervals; i++) {
      const snapshotDate = new Date(startDate);
      snapshotDate.setDate(snapshotDate.getDate() + i * 7);

      // Calculate balance at this point in time (simplified)
      const pipeline = [
        {
          $match: {
            userId,
            createdAt: { $lte: snapshotDate },
            status: TransactionStatus.COMPLETE,
            walletId: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            totalBalance: {
              $sum: {
                $cond: [
                  { $eq: ['$type', TransactionType.DEPOSIT] },
                  '$amountMsats',
                  { $multiply: ['$amountMsats', -1] },
                ],
              },
            },
          },
        },
      ];

      const result = await this.solowalletRepository.aggregate(pipeline);
      const balance =
        result.length > 0 ? Math.max(0, result[0].totalBalance) : 0;

      const growthPercentage =
        i > 0 && trends[i - 1].totalBalance > 0
          ? ((balance - trends[i - 1].totalBalance) /
              trends[i - 1].totalBalance) *
            100
          : 0;

      const netChange = i > 0 ? balance - trends[i - 1].totalBalance : 0;

      trends.push({
        date: snapshotDate,
        totalBalance: balance,
        growthPercentage,
        netChange,
      });
    }

    return trends;
  }

  private async getGoalStatistics(userId: string): Promise<GoalStatisticsDto> {
    const targetWallets = await this.solowalletRepository.find({
      userId,
      walletType: WalletType.TARGET,
      type: TransactionType.WALLET_CREATION,
    });

    let totalTargetAmount = 0;
    let totalSavedAmount = 0;
    let completedGoals = 0;
    let totalProgress = 0;
    const projectedCompletions = [];

    for (const wallet of targetWallets) {
      if (!wallet.targetAmountMsats) continue;

      const balance = await this.personalWalletService.getWalletBalance(
        userId,
        wallet.walletId!,
      );
      const progress = Math.min(
        (balance / wallet.targetAmountMsats) * 100,
        100,
      );

      totalTargetAmount += wallet.targetAmountMsats;
      totalSavedAmount += balance;
      totalProgress += progress;

      if (progress >= 100) {
        completedGoals++;
      }

      // Calculate projected completion
      if (progress < 100 && wallet.targetDate) {
        const remainingAmount = wallet.targetAmountMsats - balance;
        // const daysRemaining = Math.max(
        //   0,
        //   Math.ceil(
        //     (wallet.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        //   ),
        // );

        const savingsAnalysis = await this.getSavingsRateAnalysis(userId);
        const projectedDays =
          savingsAnalysis.averageDailySavings > 0
            ? Math.ceil(remainingAmount / savingsAnalysis.averageDailySavings)
            : Infinity;

        const projectedDate =
          projectedDays < Infinity
            ? new Date(Date.now() + projectedDays * 24 * 60 * 60 * 1000)
            : wallet.targetDate;

        const onTrack = projectedDate <= wallet.targetDate;

        projectedCompletions.push({
          walletId: wallet.walletId!,
          walletName: wallet.walletName || 'Unnamed Target',
          projectedDate,
          onTrack,
        });
      }
    }

    const averageProgress =
      targetWallets.length > 0 ? totalProgress / targetWallets.length : 0;

    return {
      totalTargets: targetWallets.length,
      completedGoals,
      activeGoals: targetWallets.length - completedGoals,
      averageProgress,
      totalTargetAmount,
      totalSavedAmount,
      projectedCompletions,
    };
  }

  private calculateAverageMonthlyGrowth(trends: GrowthTrendDto[]): number {
    if (trends.length < 2) return 0;

    const totalGrowth = trends.reduce(
      (sum, trend) => sum + trend.growthPercentage,
      0,
    );
    const averageWeeklyGrowth = totalGrowth / trends.length;

    // Convert weekly to monthly (approximate)
    return averageWeeklyGrowth * 4.33; // Average weeks per month
  }

  private calculateGoalCompletionRate(goalStats: GoalStatisticsDto): number {
    if (goalStats.totalTargets === 0) return 100;
    return (goalStats.completedGoals / goalStats.totalTargets) * 100;
  }
}
