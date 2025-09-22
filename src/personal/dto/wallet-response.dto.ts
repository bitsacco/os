import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  WalletType,
  LockPeriod,
  type WalletProgress,
  type LockInfo,
} from '../../common';

export class WalletResponseDto {
  @ApiProperty({
    description: 'Unique wallet identifier',
    example: '507f1f77bcf86cd799439011',
  })
  walletId: string;

  @ApiProperty({
    description: 'User ID who owns the wallet',
    example: 'user123',
  })
  userId: string;

  @ApiProperty({
    enum: WalletType,
    description: 'Type of wallet',
    example: WalletType.STANDARD,
  })
  walletType: WalletType;

  @ApiPropertyOptional({
    description: 'Custom wallet name',
    example: 'Emergency Fund',
  })
  walletName?: string;

  @ApiProperty({
    description: 'Current balance in msats',
    example: 500000000, // 500k sats
  })
  balance: number;

  @ApiPropertyOptional({
    description: 'Wallet tags',
    example: ['savings', 'emergency'],
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Wallet category',
    example: 'Emergency',
  })
  category?: string;

  @ApiPropertyOptional({
    description: 'User notes',
    example: 'For unexpected expenses',
  })
  notes?: string;

  @ApiProperty({
    description: 'Wallet creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-15T12:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Progress information for target wallets',
  })
  progress?: WalletProgress;

  @ApiPropertyOptional({
    description: 'Lock information for locked wallets',
  })
  lockInfo?: LockInfo;
}

export class TargetWalletResponseDto extends WalletResponseDto {
  @ApiProperty({
    enum: WalletType,
    description: 'Wallet type (TARGET)',
    example: WalletType.TARGET,
  })
  walletType: WalletType.TARGET;

  @ApiProperty({
    description: 'Target amount to save (in msats)',
    example: 1000000000,
  })
  targetAmount: number;

  @ApiPropertyOptional({
    description: 'Target date to reach the goal',
    example: '2024-12-31T23:59:59.999Z',
  })
  targetDate?: Date;

  @ApiProperty({
    description: 'Progress towards the goal',
  })
  progress: WalletProgress;
}

export class LockedWalletResponseDto extends WalletResponseDto {
  @ApiProperty({
    enum: WalletType,
    description: 'Wallet type (LOCKED)',
    example: WalletType.LOCKED,
  })
  walletType: WalletType.LOCKED;

  @ApiProperty({
    enum: LockPeriod,
    description: 'Lock period',
    example: LockPeriod.SIX_MONTHS,
  })
  lockPeriod: LockPeriod;

  @ApiProperty({
    description: 'Lock end date',
    example: '2024-12-31T23:59:59.999Z',
  })
  lockEndDate: Date;

  @ApiProperty({
    description: 'Auto-renewal setting',
    example: false,
  })
  autoRenew: boolean;

  @ApiPropertyOptional({
    description: 'Early withdrawal penalty rate (percentage)',
    example: 10,
  })
  penaltyRate?: number;

  @ApiPropertyOptional({
    description: 'Annual interest rate (percentage)',
    example: 5,
  })
  interestRate?: number;

  @ApiPropertyOptional({
    description: 'Accrued interest amount (in msats)',
    example: 25000000, // 25k sats
  })
  accruedInterest?: number;

  @ApiProperty({
    description: 'Lock information',
  })
  lockInfo: LockInfo;
}

export class WalletListResponseDto {
  @ApiProperty({
    description: 'List of wallets',
    type: [WalletResponseDto],
  })
  wallets: WalletResponseDto[];

  @ApiProperty({
    description: 'Total number of wallets',
    example: 5,
  })
  total: number;

  @ApiProperty({
    description: 'Total balance across all wallets (in msats)',
    example: 2500000000, // 2.5M sats
  })
  totalBalance: number;
}
