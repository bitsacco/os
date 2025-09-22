import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { WalletType } from '../../common';

export class WalletQueryDto {
  @ApiPropertyOptional({
    enum: WalletType,
    description: 'Filter by wallet type',
    example: WalletType.TARGET,
  })
  @IsOptional()
  @IsEnum(WalletType)
  walletType?: WalletType;

  @ApiPropertyOptional({
    description: 'Filter by tags (comma-separated)',
    example: 'savings,emergency',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    example: 'Emergency',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Include only active wallets (with balance > 0)',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activeOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Include locked status information',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeLockInfo?: boolean;

  @ApiPropertyOptional({
    description: 'Include progress information for target wallets',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeProgress?: boolean;
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Include detailed breakdown by wallet type',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeBreakdown?: boolean;

  @ApiPropertyOptional({
    description: 'Include growth trends (requires historical data)',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeTrends?: boolean;

  @ApiPropertyOptional({
    description: 'Include goal completion statistics',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeGoals?: boolean;
}
