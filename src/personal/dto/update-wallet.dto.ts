import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDate,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateWalletDto {
  @ApiPropertyOptional({
    description: 'Updated wallet name',
    example: 'Updated Emergency Fund',
  })
  @IsOptional()
  @IsString()
  walletName?: string;

  @ApiPropertyOptional({
    description: 'Updated tags for organizing wallets',
    example: ['savings', 'emergency', 'updated'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Updated spending category',
    example: 'Emergency Fund',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Updated user notes about the wallet',
    example: 'Updated notes for unexpected expenses',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTargetWalletDto extends UpdateWalletDto {
  @ApiPropertyOptional({
    description: 'Updated target amount to save (in msats)',
    example: 1500000000, // 1.5M sats = 1500000000 msats
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  targetAmountMsats?: number;

  @ApiPropertyOptional({
    description: 'Updated target amount to save (in fiat currency)',
    example: 150.75,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetAmountFiat?: number;

  @ApiPropertyOptional({
    description: 'Updated target date to reach the goal',
    example: '2025-06-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  targetDate?: Date;
}

export class UpdateLockedWalletDto extends UpdateWalletDto {
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

  @ApiPropertyOptional({
    description: 'Updated annual interest rate (percentage)',
    example: 7,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number;
}
