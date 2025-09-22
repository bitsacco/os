import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsDate, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SetTargetDto {
  @ApiPropertyOptional({
    description: 'Target amount to save (in msats)',
    example: 1000000000, // 1M sats = 1000000000 msats
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  targetAmountMsats?: number;

  @ApiPropertyOptional({
    description: 'Target amount to save (in fiat currency)',
    example: 100.5,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetAmountFiat?: number;

  @ApiPropertyOptional({
    description: 'Target date to reach the goal',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  targetDate?: Date;
}

export class UpdateTargetDto {
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

export class TargetProgressResponseDto {
  @ApiProperty({
    description: 'Current amount saved (in msats)',
    example: 500000000, // 500k sats
  })
  currentAmount: number;

  @ApiProperty({
    description: 'Target amount (in msats)',
    example: 1000000000, // 1M sats
  })
  targetAmount: number;

  @ApiProperty({
    description: 'Progress percentage (0-100)',
    example: 50,
  })
  progressPercentage: number;

  @ApiProperty({
    description: 'Amount remaining to reach target (in msats)',
    example: 500000000, // 500k sats
  })
  remainingAmount: number;

  @ApiPropertyOptional({
    description: 'Target date',
    example: '2024-12-31T23:59:59.999Z',
  })
  targetDate?: Date;

  @ApiPropertyOptional({
    description: 'Projected completion date based on current saving rate',
    example: '2024-11-15T00:00:00.000Z',
  })
  projectedCompletionDate?: Date;

  @ApiPropertyOptional({
    description: 'Days remaining to target date',
    example: 45,
  })
  daysRemaining?: number;

  @ApiProperty({
    description: 'Milestone achievement dates',
    example: ['2024-03-01T00:00:00.000Z'],
  })
  milestoneReached: Date[];

  @ApiPropertyOptional({
    description:
      'Recommended daily savings amount to reach target on time (in msats)',
    example: 11111111, // ~11k sats per day
  })
  recommendedDailySavings?: number;
}

// Aliases for backward compatibility
export { SetTargetDto as CreateTargetDto };
export { TargetProgressResponseDto as TargetResponseDto };
