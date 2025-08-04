import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AMOUNT_VALIDATION } from './base.dto';

export enum WalletType {
  SOLO = 'solo',
}

export class ExternalPaymentDto {
  @ApiProperty({
    description: 'User ID for delegated payment',
    example: '43040650-5090-4dd4-8e93-8fd342533e7c',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Wallet type marker',
    enum: WalletType,
    example: WalletType.SOLO,
  })
  @IsNotEmpty()
  @IsEnum(WalletType)
  walletType: WalletType;

  @ApiProperty({
    description: 'Target Lightning Address or LNURL',
    example: 'alice@wallet.com',
  })
  @IsString()
  target: string;

  @ApiProperty({
    description: 'Amount in satoshis',
    example: 1000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amountSats: number;

  @ApiProperty({
    description: 'Reference for the transaction',
    example: 'Payment to Alice',
  })
  @IsNotEmpty()
  @IsString()
  reference: string;

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
    description: 'Idempotency key to prevent duplicate payments',
    example: 'pay-2024-01-15-001',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description: 'Existing transaction ID to continue a pending payment',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  txId?: string;
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
    minimum: AMOUNT_VALIDATION.minimum,
  })
  @IsOptional()
  @IsNumber()
  @Min(AMOUNT_VALIDATION.minimum)
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
