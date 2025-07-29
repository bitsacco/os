import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
  IsMongoId,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExternalPaymentDto {
  @ApiProperty({
    description: 'Target Lightning Address or LNURL',
    example: 'alice@wallet.com',
  })
  @IsString()
  target: string;

  @ApiProperty({
    description: 'Amount in millisatoshis',
    example: 50000,
    minimum: 1000,
  })
  @IsNumber()
  @Min(1000)
  amountMsats: number;

  @ApiPropertyOptional({
    description: 'Optional comment for the payment',
    example: 'Thanks for the coffee!',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({
    description: 'Save this target for future payments',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  saveTarget?: boolean;

  @ApiPropertyOptional({
    description: 'Nickname for saved target',
    example: 'Alice Coffee Shop',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetNickname?: string;

  @ApiPropertyOptional({
    description: 'Payer data for LNURL-pay',
  })
  @IsOptional()
  @IsObject()
  payerData?: any;
}

export class UpdateTargetPreferencesDto {
  @ApiPropertyOptional({
    description: 'Nickname for the target',
    example: 'My favorite coffee shop',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;

  @ApiPropertyOptional({
    description: 'Mark as favorite',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional({
    description: 'Default amount in millisatoshis',
    example: 50000,
    minimum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  defaultAmount?: number;

  @ApiPropertyOptional({
    description: 'Default comment',
    example: 'Regular tip',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultComment?: string;
}

export class ListTargetsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by favorites only',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  favorites?: boolean;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

export class PaymentHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by target ID',
  })
  @IsOptional()
  @IsMongoId()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

export class ExternalPaymentResponseDto {
  @ApiProperty({
    description: 'Whether the payment was successful',
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Payment transaction ID',
  })
  paymentId?: string;

  @ApiPropertyOptional({
    description: 'Payment preimage (proof of payment)',
  })
  preimage?: string;

  @ApiPropertyOptional({
    description: 'Saved target ID if target was saved',
  })
  targetId?: string;

  @ApiProperty({
    description: 'Domain of the external service',
  })
  domain: string;

  @ApiPropertyOptional({
    description: 'Success action from external service',
  })
  successAction?: any;

  @ApiPropertyOptional({
    description: 'Error message if payment failed',
  })
  error?: string;
}

export class TargetResponseDto {
  @ApiProperty({
    description: 'Target ID',
  })
  id: string;

  @ApiProperty({
    description: 'Target type',
    enum: ['LIGHTNING_ADDRESS', 'LNURL_PAY'],
  })
  type: string;

  @ApiProperty({
    description: 'Target information',
  })
  target: {
    address?: string;
    lnurl?: string;
    domain: string;
    metadata?: any;
  };

  @ApiProperty({
    description: 'Usage statistics',
  })
  stats: {
    totalSent: number;
    paymentCount: number;
    lastUsedAt?: Date;
  };

  @ApiProperty({
    description: 'User preferences',
  })
  preferences: {
    nickname?: string;
    isFavorite: boolean;
    defaultAmount?: number;
    defaultComment?: string;
  };

  @ApiProperty({
    description: 'Creation date',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
  })
  updatedAt: Date;
}

export class ListTargetsResponseDto {
  @ApiProperty({
    description: 'List of saved targets',
    type: [TargetResponseDto],
  })
  targets: TargetResponseDto[];

  @ApiProperty({
    description: 'Total number of targets',
  })
  total: number;
}

export class PaymentHistoryItemDto {
  @ApiProperty({
    description: 'Transaction ID',
  })
  id: string;

  @ApiProperty({
    description: 'Amount in millisatoshis',
  })
  amountMsats: number;

  @ApiProperty({
    description: 'Amount in fiat currency',
  })
  amountFiat: number;

  @ApiProperty({
    description: 'Currency code',
    enum: ['KES', 'USD', 'EUR', 'GBP'],
  })
  currency: string;

  @ApiProperty({
    description: 'Transaction status',
    enum: ['PENDING', 'COMPLETE', 'FAILED', 'EXPIRED'],
  })
  status: string;

  @ApiProperty({
    description: 'Target information',
  })
  target: {
    address?: string;
    url?: string;
    domain: string;
  };

  @ApiPropertyOptional({
    description: 'Payment comment',
  })
  comment?: string;

  @ApiProperty({
    description: 'Creation date',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Completion date',
  })
  completedAt?: Date;
}

export class PaymentHistoryResponseDto {
  @ApiProperty({
    description: 'List of payments',
    type: [PaymentHistoryItemDto],
  })
  payments: PaymentHistoryItemDto[];

  @ApiProperty({
    description: 'Total number of payments',
  })
  total: number;
}
