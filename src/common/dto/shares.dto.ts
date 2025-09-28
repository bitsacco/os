import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsPositive,
  IsNumber,
  IsDateString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsNotEmptyObject,
} from 'class-validator';
import {
  FindShareTxRequest,
  OfferSharesRequest,
  ShareOfferUpdates,
  SharesTxStatus,
  type SharesTxTransferMeta,
  SharesTxUpdates,
  SubscribeSharesRequest,
  TransferSharesRequest,
  UpdateShareOfferRequest,
  UpdateSharesRequest,
  UserSharesTxsRequest,
} from '../types/shares';
import { PaginatedRequestDto } from './lib.dto';
import { ApiProperty } from '@nestjs/swagger';

export class OfferSharesDto implements OfferSharesRequest {
  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ description: 'Amount of shares to issue', example: 1000 })
  quantity: number;

  @IsNotEmpty()
  @IsDateString()
  @Type(() => String)
  @ApiProperty({
    description: 'Start date of availability (ISO 8601 format)',
    example: '2024-12-30T12:19:04.077Z',
  })
  availableFrom: string;

  @IsNotEmpty()
  @IsDateString()
  @Type(() => String)
  @ApiProperty({
    description: 'End date of availability (ISO 8601 format)',
    example: '2025-12-30T12:19:04.077Z',
  })
  availableTo?: string;
}

export class SubscribeSharesDto implements SubscribeSharesRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '3e158dfd-cb98-40b1-9ed2-a13006a9f430' })
  offerId: string;

  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ description: 'Amount of shares to subscribe', example: 21 })
  quantity: number;
}

export class TransferSharesDto implements TransferSharesRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  fromUserId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '8b158dfd-cb98-40b1-9ed2-a13006a9f671' })
  toUserId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '3e158dfd-cb98-40b1-9ed2-a13006a9f430' })
  sharesId: string;

  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ description: 'Amount of shares to transfer', example: 10 })
  quantity: number;
}

class SharesTxTransferMetaDto implements SharesTxTransferMeta {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  fromUserId: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '8b158dfd-cb98-40b1-9ed2-a13006a9f671' })
  toUserId: string;

  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ description: 'Amount of shares transferred', example: 10 })
  quantity: number;
}

class SharesTxUpdatesDto implements SharesTxUpdates {
  @IsOptional()
  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty()
  quantity?: number;

  @IsOptional()
  @IsEnum(SharesTxStatus)
  @ApiProperty({ enum: SharesTxStatus })
  status?: SharesTxStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => SharesTxTransferMetaDto)
  @ApiProperty({ type: SharesTxTransferMetaDto })
  transfer?: SharesTxTransferMeta;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '3e158dfd-cb98-40b1-9ed2-a13006a9f430' })
  offerId?: string;
}

export class UpdateSharesDto implements UpdateSharesRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '3e158dfd-cb98-40b1-9ed2-a13006a9f430' })
  sharesId: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => SharesTxUpdatesDto)
  @ApiProperty({ type: SharesTxUpdatesDto })
  updates: SharesTxUpdatesDto;
}

export class UserSharesDto implements UserSharesTxsRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '43040650-5090-4dd4-8e93-8fd342533e7c' })
  userId: string;

  @ValidateNested()
  @Type(() => PaginatedRequestDto)
  @ApiProperty({ type: PaginatedRequestDto })
  pagination: PaginatedRequestDto;
}

export class FindSharesTxDto implements FindShareTxRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '3e158dfd-cb98-40b1-9ed2-a13006a9f430' })
  sharesId: string;
}

class ShareOfferUpdatesDto implements ShareOfferUpdates {
  @IsOptional()
  @IsPositive()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({
    description: 'Total quantity of shares in the offer',
    example: 1500,
  })
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({
    description: 'Number of shares already subscribed',
    example: 300,
  })
  subscribedQuantity?: number;

  @IsOptional()
  @IsDateString()
  @Type(() => String)
  @ApiProperty({
    description: 'Updated start date of availability (ISO 8601 format)',
    example: '2024-12-30T12:19:04.077Z',
  })
  availableFrom?: string;

  @IsOptional()
  @IsDateString()
  @Type(() => String)
  @ApiProperty({
    description: 'Updated end date of availability (ISO 8601 format)',
    example: '2025-12-30T12:19:04.077Z',
  })
  availableTo?: string;
}

export class UpdateShareOfferDto implements UpdateShareOfferRequest {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: '3e158dfd-cb98-40b1-9ed2-a13006a9f430' })
  offerId: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => ShareOfferUpdatesDto)
  @ApiProperty({ type: ShareOfferUpdatesDto })
  updates: ShareOfferUpdatesDto;
}
