import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base response DTO with common success/error fields
 */
export class BaseResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Error message if operation failed',
  })
  error?: string;
}

/**
 * External payment response
 */
export class ExternalPaymentResponseDto extends BaseResponseDto {
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
}

/**
 * Target response for saved payment targets
 */
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

/**
 * List response with pagination info
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({
    description: 'Total number of items',
  })
  total: number;

  items: T[];
}

/**
 * List targets response
 */
export class ListTargetsResponseDto extends PaginatedResponseDto<TargetResponseDto> {
  @ApiProperty({
    description: 'List of saved targets',
    type: [TargetResponseDto],
  })
  items: TargetResponseDto[];
}

/**
 * Payment history item
 */
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

/**
 * Payment history response
 */
export class PaymentHistoryResponseDto extends PaginatedResponseDto<PaymentHistoryItemDto> {
  @ApiProperty({
    description: 'List of payments',
    type: [PaymentHistoryItemDto],
  })
  items: PaymentHistoryItemDto[];
}
