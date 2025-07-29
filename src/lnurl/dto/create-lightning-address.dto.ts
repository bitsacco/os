import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  ValidateNested,
  Min,
  Max,
  Length,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AddressType } from '../types';

class LightningAddressMetadataDto {
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

class LightningAddressSettingsDto {
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

export class CreateLightningAddressDto {
  @ApiProperty({
    description: 'The Lightning Address username (without @domain)',
    example: 'alice',
    minLength: 3,
    maxLength: 32,
  })
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'Address can only contain letters, numbers, dots, underscores, and hyphens',
  })
  address: string;

  @ApiPropertyOptional({
    description: 'Type of Lightning Address',
    enum: AddressType,
    default: AddressType.PERSONAL,
  })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiPropertyOptional({
    description: 'Lightning Address metadata',
    type: LightningAddressMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LightningAddressMetadataDto)
  metadata?: LightningAddressMetadataDto;

  @ApiPropertyOptional({
    description: 'Lightning Address settings',
    type: LightningAddressSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LightningAddressSettingsDto)
  settings?: LightningAddressSettingsDto;
}
