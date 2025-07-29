import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsBoolean,
  IsString,
  ValidateNested,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateLightningAddressMetadataDto {
  @ApiPropertyOptional({ description: 'Description of the Lightning Address' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Minimum sendable amount in millisatoshis',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minSendable?: number;

  @ApiPropertyOptional({
    description: 'Maximum sendable amount in millisatoshis',
  })
  @IsOptional()
  @IsNumber()
  @Max(1000000000000000) // 1M sats
  maxSendable?: number;

  @ApiPropertyOptional({ description: 'Maximum comment length allowed' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  commentAllowed?: number;
}

class UpdateLightningAddressSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable or disable the Lightning Address',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Allow comments on payments' })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @ApiPropertyOptional({ description: 'Send notifications on payment' })
  @IsOptional()
  @IsBoolean()
  notifyOnPayment?: boolean;

  @ApiPropertyOptional({ description: 'Custom success message for payments' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  customSuccessMessage?: string;
}

export class UpdateLightningAddressDto {
  @ApiPropertyOptional({
    description: 'Lightning Address metadata to update',
    type: UpdateLightningAddressMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateLightningAddressMetadataDto)
  metadata?: UpdateLightningAddressMetadataDto;

  @ApiPropertyOptional({
    description: 'Lightning Address settings to update',
    type: UpdateLightningAddressSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateLightningAddressSettingsDto)
  settings?: UpdateLightningAddressSettingsDto;
}
