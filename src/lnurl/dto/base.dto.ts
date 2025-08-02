import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Base metadata DTO that can be extended or used for composition
 */
export class BaseLightningMetadataDto {
  @ApiPropertyOptional({ description: 'Description of the Lightning Address' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Minimum sendable amount in millisatoshis',
    default: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minSendable?: number;

  @ApiPropertyOptional({
    description: 'Maximum sendable amount in millisatoshis',
    default: 100000000000,
  })
  @IsOptional()
  @IsNumber()
  @Max(1000000000000000) // 1M sats
  maxSendable?: number;

  @ApiPropertyOptional({
    description: 'Maximum comment length allowed',
    default: 255,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  commentAllowed?: number;
}

/**
 * Base settings DTO that can be extended or used for composition
 */
export class BaseLightningSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable or disable the Lightning Address',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Allow comments on payments',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @ApiPropertyOptional({
    description: 'Send notifications on payment',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyOnPayment?: boolean;

  @ApiPropertyOptional({ description: 'Custom success message for payments' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  customSuccessMessage?: string;
}

/**
 * Base pagination DTO for queries
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Number of results to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
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

/**
 * Base amount validation decorator options
 */
export const AMOUNT_VALIDATION = {
  minimum: 1_000,
  maximum: 1_000_000_000_000_000,
} as const;
