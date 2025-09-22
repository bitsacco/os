import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsDate,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LockPeriod } from '../../common';

export class CreateLockDto {
  @ApiProperty({
    enum: LockPeriod,
    description: 'Lock period for the savings',
    example: LockPeriod.SIX_MONTHS,
  })
  @IsEnum(LockPeriod)
  lockPeriod: LockPeriod;

  @ApiPropertyOptional({
    description: 'Specific lock end date (for CUSTOM lock period)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  lockEndDate?: Date;

  @ApiPropertyOptional({
    description: 'Whether to auto-renew the lock period',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional({
    description: 'Early withdrawal penalty rate (percentage)',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  penaltyRate?: number;
}

export class UpdateLockDto {
  @ApiPropertyOptional({
    description: 'Whether to auto-renew the lock period',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional({
    description: 'Updated early withdrawal penalty rate (percentage)',
    example: 15,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  penaltyRate?: number;
}

export class EarlyWithdrawRequestDto {
  @ApiProperty({
    description: 'Amount to withdraw early (in msats)',
    example: 500000000, // 500k sats
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Confirmation that user accepts penalty',
    example: true,
  })
  @IsBoolean()
  acceptPenalty: boolean;
}

export class LockStatusResponseDto {
  @ApiProperty({
    description: 'Whether the wallet is currently locked',
    example: true,
  })
  isLocked: boolean;

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
    description: 'Days remaining in lock period',
    example: 45,
  })
  daysRemaining: number;

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

  @ApiProperty({
    description: 'Whether early withdrawal is allowed',
    example: true,
  })
  canWithdrawEarly: boolean;

  @ApiPropertyOptional({
    description:
      'Penalty amount for early withdrawal of current balance (in msats)',
    example: 50000000, // 50k sats
  })
  earlyWithdrawalPenalty?: number;
}

export class EarlyWithdrawResponseDto {
  @ApiProperty({
    description: 'Amount withdrawn (in msats)',
    example: 500000000, // 500k sats
  })
  withdrawnAmount: number;

  @ApiProperty({
    description: 'Penalty amount applied (in msats)',
    example: 50000000, // 50k sats (10% penalty)
  })
  penaltyAmount: number;

  @ApiProperty({
    description: 'Net amount received after penalty (in msats)',
    example: 450000000, // 450k sats
  })
  netAmount: number;

  @ApiProperty({
    description: 'Remaining balance in locked wallet (in msats)',
    example: 500000000, // 500k sats
  })
  remainingBalance: number;

  @ApiProperty({
    description: 'Transaction reference',
    example: 'txn_early_withdrawal_123',
  })
  transactionReference: string;
}

// Aliases for backward compatibility (only for DTOs not already defined elsewhere)
export { EarlyWithdrawRequestDto as EarlyWithdrawDto };
export { UpdateLockDto as RenewLockDto };
