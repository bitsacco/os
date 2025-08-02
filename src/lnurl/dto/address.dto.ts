import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  ValidateNested,
  Length,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AddressType } from '../../common/types/lnurl';
import { BaseLightningMetadataDto, BaseLightningSettingsDto } from './base.dto';

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
    type: BaseLightningMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BaseLightningMetadataDto)
  metadata?: BaseLightningMetadataDto;

  @ApiPropertyOptional({
    description: 'Lightning Address settings',
    type: BaseLightningSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BaseLightningSettingsDto)
  settings?: BaseLightningSettingsDto;
}

export class UpdateLightningAddressDto {
  @ApiPropertyOptional({
    description: 'Lightning Address metadata to update',
    type: BaseLightningMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BaseLightningMetadataDto)
  metadata?: BaseLightningMetadataDto;

  @ApiPropertyOptional({
    description: 'Lightning Address settings to update',
    type: BaseLightningSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BaseLightningSettingsDto)
  settings?: BaseLightningSettingsDto;
}
