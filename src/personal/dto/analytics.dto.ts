import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletAnalytics } from '../../common';

export class WalletBreakdownDto {
  @ApiProperty({
    description: 'Wallet ID',
    example: '507f1f77bcf86cd799439011',
  })
  walletId: string;

  @ApiProperty({
    description: 'Wallet name',
    example: 'Emergency Fund',
  })
  walletName: string;

  @ApiProperty({
    description: 'Wallet type',
    example: 'TARGET',
  })
  walletType: string;

  @ApiProperty({
    description: 'Current balance (in msats)',
    example: 500000000, // 500k sats
  })
  balance: number;

  @ApiProperty({
    description: 'Percentage of total portfolio',
    example: 25.0,
  })
  portfolioPercentage: number;

  @ApiPropertyOptional({
    description: 'Progress percentage (for target wallets)',
    example: 50.0,
  })
  progressPercentage?: number;

  @ApiPropertyOptional({
    description: 'Days until unlock (for locked wallets)',
    example: 45,
  })
  daysUntilUnlock?: number;
}

export class GrowthTrendDto {
  @ApiProperty({
    description: 'Date of the data point',
    example: '2024-01-01T00:00:00.000Z',
  })
  date: Date;

  @ApiProperty({
    description: 'Total balance at this date (in msats)',
    example: 4500000000, // 4.5M sats
  })
  totalBalance: number;

  @ApiProperty({
    description: 'Growth percentage from previous period',
    example: 5.2,
  })
  growthPercentage: number;

  @ApiProperty({
    description: 'Net change in balance (in msats)',
    example: 200000000, // 200k sats
  })
  netChange: number;
}

export class GoalStatisticsDto {
  @ApiProperty({
    description: 'Total number of target wallets',
    example: 3,
  })
  totalTargets: number;

  @ApiProperty({
    description: 'Number of completed goals',
    example: 1,
  })
  completedGoals: number;

  @ApiProperty({
    description: 'Number of active goals',
    example: 2,
  })
  activeGoals: number;

  @ApiProperty({
    description: 'Average progress across all targets (percentage)',
    example: 65.5,
  })
  averageProgress: number;

  @ApiProperty({
    description: 'Total target amount across all goals (in msats)',
    example: 3000000000, // 3M sats
  })
  totalTargetAmount: number;

  @ApiProperty({
    description: 'Total saved towards targets (in msats)',
    example: 1500000000, // 1.5M sats
  })
  totalSavedAmount: number;

  @ApiProperty({
    description: 'Projected completion dates for active goals',
  })
  projectedCompletions: {
    walletId: string;
    walletName: string;
    projectedDate: Date;
    onTrack: boolean;
  }[];
}

export class WalletAnalyticsResponseDto implements WalletAnalytics {
  @ApiProperty({
    description: 'Total balance across all wallets (in msats)',
    example: 5000000000, // 5M sats
  })
  totalBalance: number;

  @ApiProperty({
    description: 'Total in target savings wallets (in msats)',
    example: 2000000000, // 2M sats
  })
  totalSavings: number;

  @ApiProperty({
    description: 'Total in locked wallets (in msats)',
    example: 1500000000, // 1.5M sats
  })
  totalLocked: number;

  @ApiProperty({
    description: 'Total in target wallets (in msats)',
    example: 1000000000, // 1M sats
  })
  totalTargets: number;

  @ApiProperty({
    description: 'Average monthly growth rate (percentage)',
    example: 12.5,
  })
  averageMonthlyGrowth: number;

  @ApiProperty({
    description: 'Goal completion rate (percentage)',
    example: 75.0,
  })
  goalCompletionRate: number;

  @ApiProperty({
    description: 'Portfolio distribution by wallet type',
  })
  portfolioDistribution: {
    standard: number;
    target: number;
    locked: number;
  };

  @ApiPropertyOptional({
    description: 'Detailed breakdown by wallet',
  })
  walletBreakdown?: WalletBreakdownDto[];

  @ApiPropertyOptional({
    description: 'Growth trends over time',
  })
  growthTrends?: GrowthTrendDto[];

  @ApiPropertyOptional({
    description: 'Goal statistics',
  })
  goalStatistics?: GoalStatisticsDto;
}

// Aliases for backward compatibility (only for DTOs not already defined elsewhere)
export { WalletAnalyticsResponseDto as WalletAnalyticsDto };
export { WalletAnalyticsResponseDto as UserAnalyticsDto };
