import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AMOUNT_VALIDATION } from './base.dto';

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
    minimum: AMOUNT_VALIDATION.minimum,
  })
  @IsNumber()
  @Min(AMOUNT_VALIDATION.minimum)
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
