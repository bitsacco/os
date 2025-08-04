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

/**
 * External payment response
 */
export class ExternalPaymentResponseDto {
  @ApiProperty({
    description: 'Whether the payment was successful',
  })
  success: boolean;

  @ApiProperty({
    description: 'Transaction ID',
  })
  txId: string;

  @ApiProperty({
    description: 'Status message',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Error message if payment failed',
  })
  error?: string;
}
